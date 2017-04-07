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
Object.keys(Config.access).forEach((key) => {
    const value = Config.access[key]
    if (value === '' && key !== 'setNickname') {
        throw new Error(`Bot access details are not complete in config file. Please add a value for "${key}"`)
    }
})
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
        request(`https://api.steamapis.com/market/items/${appID}?format=compact&api_key=${Config.saApiKey}`, (err, res, body) => {
            const ErrorMessage = `Failed to get the prices for application: ${appID}.`
            if (res.statusCode === 401) {
                throw new Error([
                    ErrorMessage,
                    JSON.stringify({
                        responseError: body,
                        possibleSolution: [
                            'You are using an invalid SteamApis.com API key. Fix it by adding the correct API key.',
                            'You do not have access to `market/items` url. Fix it by enabling it in: https://steamapis.com/user/upgrade',
                        ],
                    }, null, 4),
                ])
            }
            if (res.statusCode === 402) {
                throw new Error([
                    ErrorMessage,
                    JSON.stringify({
                        responseError: body,
                        possibleSolution: [
                            'You are out of funds on SteamApis.com. Fix it by adding more funds in: https://steamapis.com/user/payment',
                        ],
                    }, null, 4),
                ])
            }
            if (err || res.statusCode !== 200) {
                throw new Error([
                    ErrorMessage,
                    JSON.stringify({
                        responseError: err,
                        responseStatusCode: res.statusCode || null,
                    }, null, 4),
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
    } else {
        // Adding comments is disabled
        return callback()
    }
}
/**
 * Hande trades
 */
function acceptOffer(offer, retries) {
    let retry = retries
    if (typeof retry === 'undefined') {
        retry = 0
    }
    offer.accept((err) => {
        if (err) {
            console.log('[acceptOffer]', `Failure #${offer.id}`, err)
        } else {
            community.acceptConfirmationForObject(Config.access.identitySecret, offer.id, (acceptErr) => {
                if (acceptErr && retry <= 3) {
                    retry += 1
                    setTimeout(acceptOffer(offer, retry), 10000)
                }
            })
        }
    })
}
function calculatePriceOfOfferArray(offer, key, modifier) {
    let value = 0
    if (offer[key] && offer[key].length) {
        offer[key].forEach((item) => {
            value += item.amount * (Prices[item.appid][item.market_hash_name] * modifier || 0)
        })
    }
    return value
}
function hasNotAllowedItems(offer) {
    let hasInvalidApp = false
    if (offer.itemsToReceive && offer.itemsToReceive.length) {
        offer.itemsToReceive.forEach((item) => {
            if (Config.options.apps.indexOf(item.appid) === -1) {
                hasInvalidApp = true
            }
        })
    }
    if (offer.itemsToGive && offer.itemsToGive) {
        offer.itemsToGive.forEach((item) => {
            if (Config.options.apps.indexOf(item.appid) === -1) {
                hasInvalidApp = true
            }
        })
    }
    return hasInvalidApp
}
manager.on('newOffer', (offer) => {
    // Check if trade would go into escrow if we accept it
    offer.getUserDetails((err, me, them) => {
        const partnerSteamID = offer.partner
        const partnerSteamID64 = offer.partner.getSteamID64()
        if (err) {
            // Error getting user details, decline offer
            return commentOnProfile(partnerSteamID, Messages.Error.Unknown, true, () => {
                offer.decline()
            })
        }
        if (them.escrowDays !== 0) {
            // Trade would go into escrow, decline offer
            return commentOnProfile(partnerSteamID, Messages.Error.Escrow, true, () => {
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
            return acceptOffer(offer)
        } else if (!offer.itemsToReceive) {
            // We don't receive any items, that means we decline.
            return commentOnProfile(partnerSteamID, Messages.Error.ItemMissing, true, () => {
                console.log('[Declining]', `#${offer.id} - We don't receive any items.`)
                offer.decline()
            })
        } else if (!offer.itemsToGive) {
            // We don't give any items, that means we accept. (Donation)
            return commentOnProfile(partnerSteamID, Messages.Success.Donation, false, () => {
                console.log('[Accepting]', `#${offer.id} - It's a donation.`)
                acceptOffer(offer)
            })
        } else if (hasNotAllowedItems(offer)) {
            // We don't accept items for the given appID, that means we decline.
            return commentOnProfile(partnerSteamID, Messages.Error.InvalidApp, true, () => {
                console.log('[Declining]', `#${offer.id} - We don't accept items from this appID.`)
                offer.decline()
            })
        } else if (Config.options.price.trade && calculatePriceOfOfferArray(offer, 'itemsToReceive', Config.options.price.user) < Config.options.price.trade) {
            // Items to receive overall value is below config value, that means we decline.
            return commentOnProfile(partnerSteamID, Messages.Error.TradeValue, true, () => {
                console.log('[Declining]', `#${offer.id} - Trade value is too low.`)
                offer.decline()
            })
        } else if (calculatePriceOfOfferArray(offer, 'ItemsToReceive', Config.options.price.user) < calculatePriceOfOfferArray(offer, 'ItemsToGive', Config.options.price.bot)) {
            // User did not overpay, that means we decline.
            return commentOnProfile(partnerSteamID, Messages.Error.Overpay, true, () => {
                console.log('[Declining]', `#${offer.id} - Trade is not overpaying.`)
                offer.decline()
            })
        } else {
            // Everything is OK, that means we accept.
            return commentOnProfile(partnerSteamID, Config.options.successMessage, false, () => {
                console.log('[Accepting]', `#${offer.id} - All good.`)
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
