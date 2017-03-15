# Steam overpay bot

[![dependencies](https://img.shields.io/david/pepzwee/steam-overpay-bot.svg)](https://github.com/pepzwee/steam-overpay-bot)
[![npm](https://img.shields.io/npm/l/express.svg?style=flat-square)](https://github.com/pepzwee/steam-overpay-bot/blob/master/LICENSE)
[![steam](https://img.shields.io/badge/steam-donate-green.svg?style=flat-square)](https://steamcommunity.com/tradeoffer/new/?partner=78261062&token=2_WUiltH)
[![paypal](https://img.shields.io/badge/paypal-donate-yellow.svg)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=XKPQ3TWDYJ2Z6)

Steam bot that accepts all types of trades that are being overpaid. (Not just CS:GO)
This script is not fully tested so use with caution, like with any open-source script I suggest looking through the code first to see how it works.

## Setup

- [Get a SteamApis.com API key here](https://steamapis.com)
- Edit ``config.js``
- Upload files to server

```BASH
cd <directory of files>
npm i
```

To start the bot you have two choices.

- ``node bot.js`` - This means the script will run until you close the terminal or ``CTRL + C`` which exits the script.
- ``pm2 start bot.js -n "SteamOverpay"`` - This will keep the script running forever, when an error occurs it will restart it.

To use the ``pm2`` method install it first ``npm i -g pm2``

## Configuration

All of the options that are configurable are in ``config.js`` - all of the options are commented. 
The trade messages, except the success message, are available and editable in ``resources/TradeMessages.js``.

## Contributing

### Issues

- If you're **reporting a bug**, please include all relevant details.
	- A descriptive title helps for one. Titles of just "Error" or "It doesn't work" really don't help.
	- Please describe what you're trying to do, what actually happens, and what you can do to reproduce the problem.
	- If you have an error message or a crash, please include the full text of the error message and the stack trace.
	- Include the relevant snippet of your code. Wrap it in \`\`\`js /* code */ \`\`\` and GitHub [will format it nicely for you]

- If you're **requesting a feature**, please be descriptive and understanding.
	- A good title makes a difference. Please briefly describe what you're requesting in the title.
	- Be descriptive in the issue body, too. Say what you want to do, and ideally what the method should be named.
	- Be understanding if I don't think that your feature request falls within the scope of this module.

### Pull requests

- Please follow the existing code style. I have included ``.eslintrc.json`` file with this package, follow the rules.
- Please include a brief description of your change in the pull request if it's not immediately apparent from the code.
- Be understanding if I don't think that your change falls within the scope of this module.
