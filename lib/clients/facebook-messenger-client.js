const request = require('request');
const Session = require('../session');
const BaseClient = require('./base-client');

class FacebookMessengerClient extends BaseClient {
  init() {
    const defaults = {
      verify_token: process.env.MESSENGER_VERIFY_TOKEN,
      access_token: process.env.MESSENGER_ACCESS_TOKEN,
      graph_uri: 'https://graph.facebook.com',
    };

    this.config = Object.assign({}, defaults, this.config);

    this.bot.on('webhook', this.createWebhookHandler());
  }

  createEventHandler() {
    return (req, res, next) => {
      // If this isn't a websocket request then carry on with other handlers
      if (!{}.hasOwnProperty.call(req.query, 'facebook')) {
        next();
        return;
      }

      const data = Object.assign({}, req.query, req.body);
      const session = new Session(this.bot, data.user, this);
      this.bot.trigger(`${data.event}_event`, data.data, session);

      res.success();
    };
  }

  createWebhookHandler() {
    return (req, res, next) => {
      // If this isn't a facebook request then carry on with other handlers
      if (!{}.hasOwnProperty.call(req.headers, 'x-hub-signature') &&
        req.headers['user-agent'].indexOf('facebookplatform') === -1) {
        next();
        return;
      }

      const query = req.query;

      if (query['hub.mode'] === 'subscribe') {
        this.handleSubscription(req, res);
      } else {
        this.handleEvent(this.bot, req, res);
      }
    };
  }

  handleSubscription(req, res) {
    const query = req.query;

    if (query['hub.verify_token'] === this.config.verify_token) {
      res.send(query['hub.challenge']);
    } else {
      res.sendStatus(403);
    }
  }

  handleEvent(bot, req, res) {
    const client = this;
    const body = req.body;

    if (body.object === 'page') {
      res.status(200);

      body.entry.forEach((pageEntry) => {
        pageEntry.messaging.forEach((messagingEvent) => {
          if (messagingEvent.message) {
            client.receivedMessage(bot, messagingEvent);
          } else {
            console.error('Webhook received unknown messagingEvent: ', messagingEvent);
            res.status(400);
          }
        });
      });

      res.end();
    } else {
      res.sendStatus(400);
    }
  }

  receivedMessage(bot, event) {
    const senderID = event.sender.id;
    const message = event.message;

    const session = new Session(bot, senderID, this);

    bot.trigger('message_received', message, session);

    return session;
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
      qs: { access_token: this.config.access_token },
      method: 'POST',
      json: messageData,
    }, (error, response, body) => {
      if (!error && response.statusCode === 200) {
        console.log('Successfully sent message.');
      } else {
        console.error('Unable to send message. Please verify your access_token.');
      }
    });
  }

  startTyping(session) {
    const messageData = {
      recipient: {
        id: session.user,
      },
      sender_action: 'typing_on',
    };

    return request({
      uri: `${this.config.graph_uri}/v2.6/me/messages`,
      qs: { access_token: this.config.access_token },
      method: 'POST',
      json: messageData,
    }, (error, response, body) => {
      if (!error && response.statusCode === 200) {
        console.log('Successfully started typing indicator.');
      } else {
        console.error('Unable to start typing indicator. Please verify your access_token ');
      }
    });
  }
}

// const express = require('express');
// const bodyParser = require('body-parser');
// const crypto = require('crypto');
// const request = require('request-promise');
// const BaseBot = require('./base_bot');
//
// const baseURL = 'https://graph.facebook.com/v2.7';
// const baseMessageURL = 'https://graph.facebook.com/v2.7/me/messages';
//
// class MessengerBot extends BaseBot {
//
//   constructor(settings) {
//     super(settings);
//     this.requiresWebhook = true;
//     this.requiredCredentials = ['verifyToken', 'pageToken', 'fbAppSecret'];
//
//     // this is the id that will be set after the first message is sent to
//     // this bot.
//     this.id;
//
//     this.__applySettings(settings);
//     this.__createMountPoints();
//   }
//
//   /**
//    * sets up the app.
//    * Adds an express Router to "/telegram".
//    * sub Router contains code for posting to wehook.
//    */
//   __createMountPoints() {
//     this.app = express();
//
//     // doing this, because otherwise __verifyRe... doesn't have access
//     // to the fbAppSecret
//     this.app.use((req, res, next) => {
//       req.fbAppSecret = this.credentials.fbAppSecret;
//       next();
//     });
//     this.app.use(bodyParser.json({ verify: this.__verifyRequestSignature }));
//     this.app.use(bodyParser.urlencoded({ extended: true }));
//
//     this.app.get(this.webhookEndpoint, (req, res) => {
//       if (req.query['hub.verify_token'] === this.credentials.verifyToken) {
//         res.send(req.query['hub.challenge']);
//         console.log('token verified with:');
//         console.log(req.query['hub.verify_token']);
//       } else {
//         res.send('Error, wrong validation token');
//       }
//     });
//
//     this.app.post(this.webhookEndpoint, (req, res) => {
//       // only do this if verifyRequestSignarure didn't return false
//       if (req[req.fbAppSecret] !== false) {
//         const entries = req.body.entry;
//         this.__emitUpdatesFromEntries(entries);
//         res.sendStatus(200);
//       } else {
//         // these are actually errors. But returning a 200 nonetheless
//         // just in case errors come from messenger somehow
//         res.status(200).json(res.body);
//       }
//     });
//   }
//
// /*
//  * Verify that the callback came from Facebook. Using the App Secret from
//  * the App Dashboard, we can verify the signature that is sent with each
//  * callback in the x-hub-signature field, located in the header.
//  *
//  * https://developers.facebook.com/docs/graph-api/webhooks#setup
//  * This code is mostly adapted from wit.ai's facebook bot example.
//  *
//  */
//   __verifyRequestSignature(req, res, buf) {
//     const signature = req.headers['x-hub-signature'];
//     if (!signature) {
//       req[req.fbAppSecret] = false;
//       res.body = {
//         error: 'Error, wrong signature',
//       };
//     } else {
//       const signatureHash = signature.split('=')[1];
//
//       const expectedHash = crypto.createHmac('sha1', req.fbAppSecret)
//                           .update(buf)
//                           .digest('hex');
//
//       if (signatureHash !== expectedHash) {
//         req[req.fbAppSecret] = false;
//         res.body = {
//           error: 'Error, wrong signature',
//         };
//       }
//     }
//   }
//
//   __sendMessage(message) {
//     // TODO add request spliting when text is over 320 characters long.
//     // log warning too.
//     const options = {
//       uri: baseMessageURL,
//       qs: { access_token: this.credentials.pageToken },
//       method: 'POST',
//       json: message,
//     };
//
//     return request(options)
//
//     .then((body) => {
//       if (body.error) {
//         throw new Error(JSON.stringify(body.error));
//       }
//       return body;
//     });
//   }
//
//   __emitUpdatesFromEntries(entries) {
//     for (const entry of entries) {
//       const updates = entry.messaging;
//       entry.messaging = null;
//
//       for (const update of updates) {
//         this.__setBotIdIfNotSet(update);
//         // TODO create Messenger specific update events that developer
//         // can listen onto
//         if (update.read || update.delivery ||
//             (update.message && update.message.is_echo)) {
//           continue;
//         }
//         update.raw = entry;
//         this.__emitUpdate(update);
//       }
//     }
//   }
//
//   __setBotIdIfNotSet(update) {
//     if (!this.id) {
//       this.id = update.recipient.id;
//     }
//   }
//
//   getUserInfo(userId) {
//     const options = {
//       uri: `${baseURL}/${userId}`,
//       qs: { access_token: this.credentials.pageToken },
//       method: 'GET',
//       json: true,
//     };
//
//     return request(options)
//
//     .then((body) => {
//       if (body.error) {
//         throw new Error(JSON.stringify(body.error));
//       }
//       return body;
//     });
//   }
//
// }

module.exports = FacebookMessengerClient;
