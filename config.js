'use strict'

module.exports = {
    // Bot account details
    access: {
        username: '',
        password: '',
        identitySecret: '',
        sharedSecret: '',
        setNickname: '',
    },
    // User SteamID64's who have unrestricted access
    adminSteamID64s: [
        '',
    ],
    // SteamApis.com API key
    saApiKey: '',
    // Bot options
    options: {
        // Allow these AppID's to be traded with
        apps: [730],
        price: {
            // Minimum trade value, set it to false to accept all trade values.
            // This is calculated for items to receive only,
            // so if that overall value is less than the value specified below it will be declined.
            trade: false,
            // Bot items value (percentage)
            bot: 1,
            // User items value (percentage)
            user: 0.95,
            // Update price interval (hours)
            update: 3,
        },
        // Should the bot comment on user profile after successful trade?
        successReply: true,
        // What message should the bot reply to the profile
        successMessage: 'Thank you for trading with me! +rep',
        // Should the bot comment on user profile after failed trade with the reason?
        failureReply: true,
    },
}
