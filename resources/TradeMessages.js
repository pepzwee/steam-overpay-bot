'use strict'

module.exports = {
    Error: {
        TradeValue: 'Sorry! Your trade was rejected, because it\'s value is too low.',
        Overpay: 'Sorry! Your trade was rejected, because you did not overpay enough.',
        ItemMissing: 'Sorry! Your trade was rejected, because you did not add any items on your side.',
        Escrow: 'Sorry! Your trade was rejected, because you do not have two-factor authentication enabled. We do not accept trades that go into escrow.',
        InvalidApp: 'Sorry! Your trade was rejected, because we do not accept items from one or more appID\'s you selected.',
        Unknown: 'Sorry! Your trade was rejected, because something went wrong with verifying the trade. Please try again later or contact the owner!',
    },
    Success: {
        Donation: 'Thank you! Your donation is greatly appreciated. +rep',
    },
}
