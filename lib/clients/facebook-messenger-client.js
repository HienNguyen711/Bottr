const request = require('request');
const BaseClient = require('./base-client');
const assert = require('assert');
const crypto = require('crypto');

//TODO: Move to core file
Array.prototype.flatMap = function(lambda) {
    return Array.prototype.concat.apply([], this.map(lambda));
};

//TODO: Extract into modules ?
class FacebookMessengerClient extends BaseClient {

    __clientWillStart(bot, config) {

        const defaults = {
            namespace: "facebook",
            verify_token: process.env.MESSENGER_VERIFY_TOKEN,
            access_token: process.env.MESSENGER_ACCESS_TOKEN,
            graph_uri: 'https://graph.facebook.com/v2.7',
        };

        var config = Object.assign({}, defaults, config);

        super.__clientWillStart(bot, config)

        assert(config.verify_token, "Messenger verify token not provided")
        assert(config.access_token, "Messenger access token not provided")

        this.access_token = config.access_token
        this.verify_token = config.verify_token
    }

    __handleWebhookRequest(req, res, buf) {
        this.__verifyRequestSignature(req, res, buf)

        const query = req.query;

        if (query['hub.mode'] === 'subscribe') {
            this.__handleSubscription(req, res);
        } else {
            this.__handleEvent(req, res);
        }
    }

    send(session, text, attachment) {
        console.log(`Sending "${text}"`);

        const messageData = {
            recipient: {
                id: session.user,
            },
            message: {},
        };

        if (text) {
            messageData.message.text = text;
        }

        if (attachment) {
            messageData.message.attachment = {
                type: attachment.type,
                url: attachment.url,
            };
        }

        return request({
            uri: `${this.config.graph_uri}/v2.6/me/messages`,
            qs: {
                access_token: this.config.access_token
            },
            method: 'POST',
            json: messageData,
        }, (error, response, body) => {
            if (!error && response.statusCode === 200) {
                console.log('Successfully sent message.');
            } else {
                console.error(
                    'Unable to send message. Please verify your access_token.'
                );
            }
        });
    }

    getUserInfo(userId) {
        const options = {
            uri: `${baseURL}/${userId}`,
            qs: {
                access_token: this.credentials.pageToken
            },
            method: 'GET',
            json: true,
        };

        return request(options)

        .then((body) => {
            if (body.error) {
                throw new Error(JSON.stringify(body.error));
            }
            return body;
        });
    }

    /*
     * Verify that the callback came from Facebook. Using the App Secret from
     * the App Dashboard, we can verify the signature that is sent with each
     * callback in the x-hub-signature field, located in the header.
     *
     * https://developers.facebook.com/docs/graph-api/webhooks#setup
     * This code is mostly adapted from wit.ai's facebook bot example.
     *
     */
    __verifyRequestSignature(req, res, buf) {
        const signature = req.headers['x-hub-signature'];

        if (!signature) {
            res.body = {
                error: 'Error, wrong signature',
            };
        } else {
            const signatureHash = signature.split('=')[1];

            const expectedHash = crypto.createHmac('sha1', req.fbAppSecret)
                .update(buf)
                .digest('hex');

            if (signatureHash !== expectedHash) {
                res.body = {
                    error: 'Error, wrong signature',
                };
            }
        }
    }

    __handleSubscription(req, res) {
        const query = req.query;

        if (query['hub.verify_token'] === this.verify_token) {
            res.send(query['hub.challenge']);
        } else {
            res.sendStatus(403);
        }
    }

    __handleEvent(req, res) {
        const body = req.body;

        if (body.object === 'page') {
            res.status(200);

            var messagingEvents = body.entry.flatMap((entry) => {
                return entry.messaging
            })

            messagingEvents.forEach((messagingEvent) => {
                if (!this.__handleMessagingEvent(messagingEvent)) {
                    res.status(400);
                }
            })

            res.end();
        } else {
            res.sendStatus(400);
        }
    }

    __handleMessagingEvent(event) {

        if (event.message) {
            __receivedUpdate(event);
            return true
        } else {
            console.error('Webhook received unknown messagingEvent: ',
                messagingEvent);
            return false
        }
    }

    __sendMessage(message) {
        const options = {
            uri: `${this.config.graph_uri}/me/messages`,
            qs: {
                access_token: this.access_token
            },
            method: 'POST',
            json: message,
        };

        return request(options)
            .then((body) => {
                if (body.error) {
                    throw new Error(JSON.stringify(body.error));
                }
                return body;
            });
    }
}

module.exports = FacebookMessengerClient;