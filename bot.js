'use strict'

/**
 * Configuration and resources
 */
const Config = require('./config')
const Messages = require('./resources/TradeMessages')

/**
 * Require necessary modules
 */
const SteamUser = require('steam-user')
const TradeOfferManager = require('steam-tradeoffer-manager')
const SteamTotp = require('steam-totp')
const SteamCommunity = require('steamcommunity')
const request = require('request')
const fs = require('fs')

/**
 * Setup
 */
const community = new SteamCommunity()
const client = new SteamUser()
const manager = new TradeOfferManager({
    steam: client,
    domain: 'example.com',
    language: 'en',
})

/**
 * Authenticate
 */
client.logOn({
    accountName: Config.access.username,
    password: Config.access.password,
    twoFactorCode: SteamTotp.generateAuthCode(Config.access.sharedSecret),
})

/**
 * Fetch prices for each enabled AppID
 */
const Prices = {}
function getPricesForApps() {
    if (!Config.options.apps.length) {
        throw new Error('You did not add any allowed applications in your config file.')
    }
    Config.options.apps.forEach((appID) => {
        request(`https://api.steamapis.com/market/items/${appID}?format=compact&api_key${Config.saApiKey}`, (err, res, body) => {
            const ErrorMessage = `Failed to get the prices for application: ${appID}.`
            if (res.statusCode === 401) {
                throw new Error([
                    ErrorMessage,
                    {
                        responseError: body,
                        possibleSolution: [
                            'You are using an invalid SteamApis.com API key. Fix it by adding the correct API key.',
                            'You do not have access to `market/items` url. Fix it by enabling it in: https://steamapis.com/user/upgrade',
                        ],
                    },
                ])
            }
            if (res.statusCode === 402) {
                throw new Error([
                    ErrorMessage,
                    {
                        responseError: body,
                        possibleSolution: [
                            'You are out of funds on SteamApis.com. Fix it by adding more funds in: https://steamapis.com/user/payment',
                        ],
                    },
                ])
            }
            if (err || res.statusCode !== 200) {
                throw new Error([
                    ErrorMessage,
                    {
                        responseError: err,
                        responseStatusCode: res.statusCode || null,
                    },
                ])
            }
            Prices[appID] = JSON.parse(body)
        })
    })
}
/**
 * Get the prices for apps and set the interval
 */
getPricesForApps()
setInterval(getPricesForApps, Config.options.price.update * 1000 * 3600)

/**
 * Comment on user profile
 */
function commentOnProfile(steamID, message, isError, callback) {
    // Check if bot should add comments
    if (Config.options.failureReply && Config.options.successReply) {
        // Check if message is an error and adding error comments is disabled
        if (isError && !Config.options.failureReply) {
            return callback()
        }
        // Check if message is a success and adding success comments is disabled
        if (!isError && !Config.options.successReply) {
            return callback()
        }
        community.getSteamUser(steamID, (err, CSteamUser) => {
            if (err) {
                console.log('[Error] Failed to get Steam user while trying to add a comment on their profile.', err)
                callback()
            } else {
                /**
                 * We don't really care if the comment is added or not so we don't check for errors.
                 */
                CSteamUser.comment(message, callback)
            }
        })
    }
    // Adding comments is disabled
    return callback()
}
/**
 * Hande trades
 */
function acceptOffer(offer) {
    offer.accept((err) => {
        if (err) {
            console.log('[acceptOffer]', `Failure #${offer.id}`, err)
        } else {
            community.checkConfirmations()
        }
    })
}
function calculatePriceOfOfferArray(offer, key, modifier) {
    let value = 0
    offer[key].forEach((item) => {
        value += item.amount * (Prices[item.appid][item.market_hash_name] * modifier || 0)
    })
    return value
}
manager.on('newOffer', (offer) => {
    // Check if trade would go into escrow if we accept it
    offer.getUserDetails((err, me, them) => {
        const partnerSteamID64 = offer.partner.getSteamID64()
        if (err) {
            // Error getting user details, decline offer
            commentOnProfile(partnerSteamID64, Messages.Error.Unknown, true, () => {
                offer.decline()
            })
        }
        if (them.escrowDays !== 0) {
            // Trade would go into escrow, decline offer
            commentOnProfile(partnerSteamID64, Messages.Error.Escrow, true, () => {
                offer.decline()
            })
        }

        console.log('[newOffer]', `#${offer.id} from ${partnerSteamID64}`)

        /**
         * Trade checks
         */
        if (Config.adminSteamID64s.indexOf(partnerSteamID64) !== -1) {
            // Trade came from an admin, that means we accept.
            console.log('[Accepting]', `#${offer.id} - User is an admin.`)
            acceptOffer(offer)
        } else if (!offer.itemsToReceive) {
            // We don't receive any items, that means we decline.
            commentOnProfile(partnerSteamID64, Messages.Error.ItemMissing, true, () => {
                offer.decline()
            })
        } else if (!offer.itemsToGive) {
            // We don't give any items, that means we accept. (Donation)
            commentOnProfile(partnerSteamID64, Messages.Success.Donation, false, () => {
                acceptOffer(offer)
            })
        } else if (Config.options.price.trade && calculatePriceOfOfferArray(offer, 'itemsToReceive', Config.options.price.user) < Config.options.price.trade) {
            // Items to receive overall value is below config value, that means we decline.
            commentOnProfile(partnerSteamID64, Messages.Error.TradeValue, true, () => {
                offer.decline()
            })
        } else if (calculatePriceOfOfferArray(offer, 'ItemsToReceive', Config.options.price.user) < calculatePriceOfOfferArray(offer, 'ItemsToGive', Config.options.price.bot)) {
            // User did not overpay, that means we decline.
            commentOnProfile(partnerSteamID64, Messages.Error.Overpay, true, () => {
                offer.decline()
            })
        } else {
            // Everything is OK, that means we accept.
            commentOnProfile(partnerSteamID64, Config.options.successMessage, false, () => {
                acceptOffer(offer)
            })
        }
    })
})

/**
 * Polldata
 */
manager.on('pollData', (pollData) => {
    fs.writeFile('polldata.json', JSON.stringify(pollData))
})
if (fs.existsSync('polldata.json')) {
    manager.pollData = JSON.parse(fs.readFileSync('polldata.json'))
}

/**
 * Client listeners
 */
client.on('loggedOn', () => {
    console.log('[loggedOn]', Config.access.username)
    client.setPersona(SteamUser.Steam.EPersonaState.Online, Config.access.setNickname)
})
client.on('webSession', (sessionID, cookies) => {
    manager.setCookies(cookies, (err) => {
        if (err) {
            console.log('[setCookies] Error: ', err)
        }
    })

    community.setCookies(cookies)
})

/**
 * Refresh bot sessions each hour
 */
setInterval(() => {
    client.webLogOn()
}, 1000 * 3600)
