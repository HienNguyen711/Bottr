const Express = require('express');

/*
Base Client from which all clients are dervied from.

Subclass this to allow your Bot wo work on an additional service.
*/
class BaseClient {

  constructor(config) {

    const client = (bot) => {

      this.bot = bot;
      this.config = config;
      this.router = bot.createEndpointNamespace(config.namespace)

      this.__registerWebhook()
      this.__registerEventEndpoint()

      return this;
    };

    return client.bind(this);
  }

  /**
   * Sends a new message.
   *
   * @param {Object} session
   * @param {String} text
   */
  // eslint-disable-next-line class-methods-use-this, no-unused-vars
  send(session, text) {
    // do nothing
  }

  /**
   * Callback function when the client starts typing.
   *
   * @param {Object} session
   */
  // eslint-disable-next-line class-methods-use-this, no-unused-vars
  startTyping(session) {
    // do nothing
  }

  __registerWebhook() {

      this.router.get('/webhook', this.handleWebhookRequest.bind(this));
      this.router.post('/webhook', this.handleWebhookRequest.bind(this));

      this.eventEmitter.fallback('webhook', function(req, res) {
          res.error('No webhook handlers configured')
      }.bind(this))
  }

  __registerEventEndpoint() {

      this.router.post('/event', this.handleEventRequest.bind(this))

      this.eventEmitter.fallback('event', function(req, res) {
          res.error('No event handlers configured')
      }.bind(this))
  }

  handleEventRequest(req, res) {
  }

  handleWebhookRequest(req, res) {
  }

    /**
     * Format the update gotten from the bot source (telegram, messenger etc..).
     * Returns an update in a standard format
     *
     * @param {object} rawUpdate
     * @return {object} update
     */
    __formatUpdate(rawUpdate) {}


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
      return this.__runOutgoingMiddleware(message)

      .then(this.__sendMessage.bind(this))

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

    __sendMessage(message) {}

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
     * sendTextMessageTo() Just makes it easier to send a text message with
     * minimal structure.
     * @param {string} text
     * @param {string} recipientId
     *
     * @return {Promise} promise
     */
    sendTextMessageTo(text, recipientId, cb) {
      const message = {
        text,
      };
      return this.sendMessageTo(message, recipientId, cb);
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
     * sendDefaultButtonMessageTo() makes it easier to send a default set of
     * buttons. The default button type is the Messenger quick_replies. Each
     * integration has its opinionated equivalent. Keyboard buttons for Telegram
     * and simple text with newlines for Twitter(as Twitter DM has no buttons).
     *
     * @param {Array} buttonTitles
     * @param {string} recipientId
     * @param {string/object} textOrAttachment - optional
     *
     * @return {Promise} promise
     */
    sendDefaultButtonMessageTo(buttonTitles, recipientId, textOrAttachment, cb) {
      if (buttonTitles.length > 10) {
        const error = new Error('ERROR: buttonTitles must be of length 10 or less');
        if (cb) {
          return cb(error);
        }
        return new Promise((resolve, reject) => reject(error));
      }

      const message = {};
      // deal with textOrAttachment
      if (!textOrAttachment) {
        message.text = 'Please select one of:';
      } else if (textOrAttachment.constructor === String) {
        message.text = textOrAttachment;
      } else if (textOrAttachment.constructor === Object) {
        message.attachment = textOrAttachment;
      } else {
        const error = new Error('ERROR: third argument must be a "String", "Object" or absent');
        if (cb) {
          return cb(error);
        }
        return new Promise((resolve, reject) => reject(error));
      }

      message.quick_replies = [];
      for (const buttonTitle of buttonTitles) {
        message.quick_replies.push({
          content_type: 'text',
          title: buttonTitle,
          payload: buttonTitle, // indeed, in default mode payload in buttonTitle
        });
      }
      return this.sendMessageTo(message, recipientId, cb);
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
    sendIsTypingMessageTo(recipientId, cb) {
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
}

module.exports = BaseClient;
