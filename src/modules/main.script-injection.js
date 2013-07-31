/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


// Add hooks to documents (cookie, localStorage, ...)

var DocStartScriptInjection = {

  _innerWindows: Object.create(null),
  _sentByChrome: null,
  _sentByContent: null,
  _loader: null,


  init: function() {
    console.assert(this._loader === null, "this._loader is already initialized");
    this._sentByChrome  = "multifox-chrome_event-"  + Math.random().toString(36).substr(2);
    this._sentByContent = "multifox-content_event-" + Math.random().toString(36).substr(2);
    this._loader = new ScriptSourceLoader();
    Services.obs.addObserver(this, "document-element-inserted", false);
    Services.obs.addObserver(this._onInnerDestroyed, "inner-window-destroyed", false);
    this._initCurrent();
  },


  stop: function() {
    Services.obs.removeObserver(this, "document-element-inserted");
    Services.obs.removeObserver(this._onInnerDestroyed, "inner-window-destroyed");
    this._loader = null;

    var innerWindows = this._innerWindows;
    this._innerWindows = Object.create(null);

    // nuke all sandboxes
    for (var id in innerWindows) {
      var sandbox = innerWindows[id];
      console.assert(sandbox !== null, "sandbox cannot be null", id);
      Cu.nukeSandbox(sandbox);
    }
  },

  _forEachWindow: function(fn, win) {
    fn(win);
    for (var idx = win.length - 1; idx > -1; idx--) {
      this._forEachWindow(fn, win[idx]);
    }
  },

  _initCurrent: function() {
    var enumWin = Services.wm.getEnumerator("navigator:browser");
    while (enumWin.hasMoreElements()) {
      var win = enumWin.getNext();
      var id = Profile.getIdentity(win);
      if (Profile.isNativeProfile(id)) {
        continue;
      }
      var tabbrowser = win.getBrowser();
      for (var idx = tabbrowser.length - 1; idx > -1; idx--) {
        this._forEachWindow(DocStartScriptInjection._initWindow,
                            tabbrowser.browsers[idx].contentWindow);
      }
    }
  },

  get eventSentByChrome() {
    return this._sentByChrome;
  },

  get eventSentByContent() {
    return this._sentByContent;
  },


  _onInnerDestroyed: {
    observe: function(subject, topic, data) {
      var id = subject.QueryInterface(Ci.nsISupportsPRUint64).data.toString();
      delete DocStartScriptInjection._innerWindows[id];
    }
  },


  QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver]),
  observe: function(subject, topic, data) {
    var win = subject.defaultView;
    if (win !== null) { // xsl/xbl
      this._initWindow(win);
    }
  },


  _initWindow: function(win) {
    var winInfo = FindIdentity.fromContent(win);
    if (Profile.isNativeProfile(winInfo.profileNumber)) {
      return;
    }

    if (winInfo.browserElement) {
      ErrorHandler.onNewWindow(win, winInfo.browserElement);
    }

    switch (win.location.protocol) {
      case "http:":
      case "https:":
        break;
      default:
        return;
    }

    var sandbox = Cu.Sandbox(win, {sandboxName: "multifox-content"});
    sandbox.window = XPCNativeWrapper.unwrap(win);
    sandbox.document = XPCNativeWrapper.unwrap(win.document);

    var src = this._loader.getScript();
    try {
      Cu.evalInSandbox(src, sandbox);
    } catch (ex) {
      ErrorHandler.addScriptError(win, "sandbox", subject.documentURI + " " + "//exception=" + ex);
      Cu.nukeSandbox(sandbox);
      return;
    }

    // keep a reference to Cu.nukeSandbox (Cu.getWeakReference won't work for that)
    var innerId = win.QueryInterface(Ci.nsIInterfaceRequestor)
                     .getInterface(Ci.nsIDOMWindowUtils).currentInnerWindowID.toString();
    console.assert((innerId in this._innerWindows) === false, "dupe sandbox @", innerId)
    this._innerWindows[innerId] = sandbox;
  }
};


function ScriptSourceLoader() {
  this._src = null;
  this._load(true);
}


ScriptSourceLoader.prototype = {

  getScript: function() {
    if (this._src === null) {
      this._load(false);
    }
    return this._src;
  },

  _load: function(async) {
    var me = this;
    var xhr = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(Ci.nsIXMLHttpRequest);
    xhr.onload = function() {
      me._src = xhr.responseText + "initContext(window, document, '"
                                 + DocStartScriptInjection.eventSentByChrome + "','" + DocStartScriptInjection.eventSentByContent + "');";
    };
    xhr.open("GET", "${PATH_CONTENT}/content-injection.js", async);
    xhr.overrideMimeType("text/plain");
    xhr.send(null);
  }
};
