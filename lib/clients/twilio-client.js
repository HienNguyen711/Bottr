const Twilio = require('twilio');
const BaseClient = require('./base-client');
const assert = require('assert');

// Currently this client only supports texts but in the future could support calls
class TwilioClient extends BaseClient {

    __clientWillStart(bot, config) {
        const defaults = {
            account_sid: process.env.TWILIO_ACCOUNT_SID,
            auth_token: process.env.TWILIO_AUTH_TOKEN,
            phone_number: process.env.TWILIO_PHONE_NUMBER,
        };

        var config = Object.assign({}, defaults, config);

        assert(config.account_sid, "Account SID not provided")
        assert(config.auth_token, "Auth Token not provided")
        assert(config.phone_number, "Phone Number not provided")

        this.twilio = Twilio(config.account_sid, config.auth_token);
        this.phone_number = config.phone_number;
    }

    __handleWebhookRequest(req, res, buf) {
        const data = Object.assign({}, req.query, req.body);

        const message = {
            text: data.Body,
        };

        const session = new Session(this.bot, data.From, this);

        this.bot.trigger('message_received', message, session);
        res.send({}); // We can't send a success code as twillio will send it

        return session;
    }

    __sendMessage(message) {

        this.twilio.sendMessage({
            to: session.user,
            from: this.phone_number,
            body: text,
        });
    }
}

module.exports = TwilioClient;