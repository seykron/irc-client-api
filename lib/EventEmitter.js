window.irc = window.irc || {};

/** Utility to register and trigger events.
 * @constructor
 */
irc.EventEmitter = function() {

  /** Registered listeners for this emitter.
   * @type {Object[String => Function[]]}
   * @private
   * @fieldOf irc.EventEmitter#
   */
  var eventListeners = {};

  return {

    /** Registers an event listener.
     *
     * @param {String} eventName Name of the event to wait for. Cannot be null or
     *    empty.
     * @param {Function} listener Invoked when the event occurs, it takes a data
     *    object related to the event as parameter. Cannot be null.
     * @param {Boolean} [once] Indicates whether the listener will be triggered
     *    only once. Default is false.
     * @param {Boolean} [enqueue] Indicates whether the listener is added to a
     *    queue. If so, listeners are executed once each time the event is
     *    triggered in the order they were added to the queue. By default the
     *    event is not added to a queue.
     */
    on: function (eventName, listener, once, enqueue) {
      var name = eventName.toString().toLowerCase();

      if (!eventListeners.hasOwnProperty(name)) {
        eventListeners[name] = [];
      }
      eventListeners[name].push({
        enqueue: enqueue || false,
        once: once || false,
        callback: listener
      });
    },

    /** Adds an event lister than only is triggered once.
     *
     * @param {String} eventName Name of the event to wait for. Cannot be null or
     *    empty.
     * @param {Function} listener Invoked when the event occurs, it takes a data
     *    object related to the event as parameter. Cannot be null.
     * @param {Boolean} [enqueue] Indicates whether the listener is added to a
     *    queue. If so, listeners are executed once each time the event is
     *    triggered in the order they were added to the queue. By default the
     *    event is not added to a queue.
     */
    once: function (eventName, listener, enqueue) {
      this.on(eventName, listener, true, enqueue);
    },

    /** Indicates whether the specified event has registered listeners.
     * @param {String} eventName Name of the event to verify. Cannot be null or
     *    empty.
     */
    hasHandler: function (eventName) {
      return eventListeners.hasOwnProperty(eventName) &&
        eventListeners[eventName].length > 0;
    },

    /** Triggers and event and pass the specified data.
     * @param {String} eventName Name of the event to trigger. Cannot be null.
     * @param {Object...} [data] Any number of parameters with data related to
     *    the event. Can be null.
     */
    emit: function (eventName, data) {
      var name = String(eventName).toLowerCase();
      var params = [];
      var triggeredOnce = false;
      var i;

      if (!eventListeners.hasOwnProperty(name)) {
        return;
      }

      for (i = 1; i < arguments.length; i++) {
        params.push(arguments[i]);
      }

      eventListeners[name] = eventListeners[name].filter(function (listener) {
        listener.callback.apply(null, params);

        if (listener.once) {
          triggeredOnce = true;
        }

        // It must be triggered always or it must be triggered once and
        // is enqueued.
        return (listener.once === false) ||
          (listener.once && listener.enqueue && triggeredOnce);
      });
    }
  };
};
