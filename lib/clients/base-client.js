const Express = require('express');
const assert = require('assert');
const queue = require('queue');

/*
Base Client from which all clients are dervied from.

Subclass this to allow your Bot to work on an additional service.
*/
class BaseClient {

    constructor(config) {

        const client = (bot) => {
            this.__clientWillStart(bot, config)
            return this;
        };

        return client.bind(this);
    }

    /**
     * sendMessage() falls back to the sendMessage implementation of whatever
     * subclass inherits form BaseBot. The expected format is normally any type of
     * message object that could be sent on to messenger
     * @param {object} message
     *
     * @return {Promise} promise
     * The returned promise for all sendMessage type events returns a body that
     * looks something like this:
     *  {
     *   raw: rawBody,
     *   recipient_id: <id_of_user>,
     *   message_id: <message_id_of_what_was_just_sent>
     *  }
     *
     * Some platforms may not have either of these paramters. If that's the case,
     * the value assigned will be null or some other suitable value as the
     * equivalent to Messenger's seq in Telegram.
     *
     */
    sendMessage(message, cb) {

        // TODO: Implement conversation management
        //         this.queue.push((cb) => {
        //             session.startTyping();
        //
        //             let typingTime = 0;
        //
        //             if (text) {
        //                 const averageWordsPerMinute = 600;
        //                 const averageWordsPerSecond = averageWordsPerMinute /
        //                     60;
        //                 const averageWordsPerMillisecond =
        //                     averageWordsPerSecond / 1000;
        //                 const totalWords = text.split(' ').length;
        //                 typingTime = totalWords /
        //                     averageWordsPerMillisecond;
        //             }
        //
        //             setTimeout(() => {
        //                 session.client.send(session, text,
        //                     attachment);
        //                 cb();
        //             }, typingTime);
        //         });
        //
        //         this.queue.start();

        return this.__sendMessage.bind(this)
            .then((body) => {
                if (cb) {
                    return cb(null, body);
                }
                return body;
            })

        .catch((err) => {
            if (cb) {
                return cb(err);
            }

            throw err;
        });
    }

    /**
     * sendMessageTo() Just makes it easier to send a message without as much
     * structure. message object can look something like this:
     * message: {
     *  text: 'Some random text'
     * }
     * @param {object} message
     * @param {string} recipientId
     *
     * @return {Promise} promise
     */

    //TODO: "Text" or { text: "text" }
    sendMessageTo(message, recipientId, cb) {
        const fullMessageObject = {
            recipient: {
                id: recipientId,
            },
            message,
        };
        return this.sendMessage(fullMessageObject, cb);
    }

    /**
     * reply() Another way to easily send a text message. In this case,
     * we just send the update that came in as is and then the text we
     * want to send as a reply.
     * @param {object} incommingUpdate
     * @param {string} text
     *
     * @return {Promise} promise
     */
    reply(incomingUpdate, text, cb) {
        return this.sendTextMessageTo(text, incomingUpdate.sender.id, cb);
    }

    /**
     * sendAttachmentTo() makes it easier to send an attachment message with
     * less structure. attachment typically looks something like this:
     * const attachment = {
     *   type: 'image',
     *   payload: {
     *     url: "some_valid_url_of_some_image"
     *   },
     * };
     * @param {object} attachment
     * @param {string} recipientId
     *
     * @return {Promise} promise
     */
    sendAttachmentTo(attachment, recipientId, cb) {
        const message = {
            attachment,
        };
        return this.sendMessageTo(message, recipientId, cb);
    }

    /**
     * sendAttachmentFromURLTo() makes it easier to send an attachment message with
     * minimal structure.
     * @param {string} type
     * @param {string} url
     * @param {string} recipientId
     *
     * @return {Promise} promise
     */
    sendAttachmentFromURLTo(type, url, recipientId, cb) {
        const attachment = {
            type,
            payload: {
                url,
            },
        };
        return this.sendAttachmentTo(attachment, recipientId, cb);
    }

    /**
     * sendIsTypingMessageTo() just sets the is typing status to the platform
     * if available.
     * based on the passed in update
     *
     * @param {string} recipientId
     *
     * @return {Promise} promise
     * The returned value is different from the standard one. It looks something
     * like this in this case:
     *
     * {
     *   recipient_id: <id_of_user>
     * }
     *
     */
    startTyping(recipientId, cb) {

        const isTypingMessage = {
            recipient: {
                id: recipientId,
            },
            sender_action: 'typing_on',
        };

        return this.sendMessage(isTypingMessage, cb);
    }

    /**
     * Retrieves the basic user info from a user if platform supports it
     *
     * @param {string} userId
     *
     * @return {Promise} promise that resolves into the user info or an empty object by default
     */
    getUserInfo(userId) {
        return new Promise(resolve => resolve());
    }

    startTopic(topicID) {
        console.log(`Started Topic ${topicID}`);
        this.updateUserContext({
            currentTopic: topicID,
        });
    }

    finishTopic() {
        console.log('Finished Topic');
        this.updateUserContext({
            currentTopic: undefined,
        });
    }

    getUserContext(defaults) {
        const context = this.bot.memory.users[this.user] || {};
        return Object.assign({}, defaults || {}, context);
    }

    updateUserContext(newValues) {
        const context = this.bot.memory.users[this.user] || {};
        this.bot.memory.users[this.user] = Object.assign(context, newValues);
    }

    /**
     *
     */
    __clientWillStart(bot, config) {

        var defaults = {}
        var config = Object.assign({}, defaults, config);

        assert(config.namespace, "Namespace not provided")

        this.bot = bot
        this.router = bot.createEndpointNamespace(config.namespace)

        this.queue = queue();
        this.queue.concurrency = 1;

        this.__registerWebhook()
        this.__registerEventEndpoint()
    }

    /**
     * Internal method for registering webhook endpoint
     */
    __registerWebhook() {
        this.router.get('/webhook', this.__handleWebhookRequest.bind(this));
        this.router.post('/webhook', this.__handleWebhookRequest.bind(this));
    }

    /**
     * Internal method for registering event endpoint
     */
    __registerEventEndpoint() {
        this.router.post('/event', this.__handleEventRequest.bind(this))
    }

    /**
     * Internal method for handling the webhook request
     */
    __handleWebhookRequest(req, res, buf) {}

    /**
     * Internal method for handling event request
     */
    __handleEventRequest(req, res) {

        const data = Object.assign({}, req.query, req.body);
        const session = new Session(this.bot, data.user, this);
        this.bot.trigger(`${data.event}_event`, data.data, session);

        res.success();
    }

    /**
     * Internal method fo handling update
     */
    __receivedUpdate(update) {
        const formattedUpdate = this.__formatUpdate(update)
        bot.trigger('message_received', this, formattedUpdate);
    }

    /**
     * Format the update gotten from the bot source (telegram, messenger etc..).
     * Returns an update in a standard format
     *
     * @param {object} rawUpdate
     * @return {object} update
     */
    __formatUpdate(rawUpdate) {
        rawUpdate.raw = rawUpdate
        return rawUpdate
    }

    /**
     * Internal method for sending the message
     */
    __sendMessage(message) {}
}

module.exports = BaseClient;