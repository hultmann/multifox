/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


// Add hooks to documents (cookie, localStorage, ...)

var DocStartScriptInjection = {

  _innerWindows: Object.create(null),
  _src: null,


  init: function() {
    console.assert(this._src === null, "this._src is already initialized");
    this._src = "(" + contentScriptSource.toSource() + ")()";
    Services.obs.addObserver(this._onDocumentInserted, "document-element-inserted", false);
    Services.obs.addObserver(this._onInnerDestroyed, "inner-window-destroyed", false);
    this._initCurrent();
  },


  stop: function() {
    Services.obs.removeObserver(this._onDocumentInserted, "document-element-inserted");
    Services.obs.removeObserver(this._onInnerDestroyed, "inner-window-destroyed");
    this._src = null;

    var innerWindows = this._innerWindows;
    this._innerWindows = Object.create(null);

    // nuke all sandboxes
    for (var id in innerWindows) {
      var sandbox = innerWindows[id];
      console.assert(sandbox !== null, "sandbox cannot be null", id);

      // avoid "can't access dead object" errors
      delete sandbox.document.cookie;
      delete sandbox.window.localStorage;
      delete sandbox.window.indexedDB;
      delete sandbox.window.mozIndexedDB;

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
      for (var browser of UIUtils.getBrowserList(enumWin.getNext())) {
        if (Profile.isExtensionProfile(Profile.getIdentity(browser))) {
          this._forEachWindow(DocStartScriptInjection._initWindow,
                              browser.contentWindow);
        }
      }
    }
  },


  _onInnerDestroyed: {
    observe: function(subject, topic, data) {
      var id = subject.QueryInterface(Ci.nsISupportsPRUint64).data.toString();
      delete DocStartScriptInjection._innerWindows[id];
    }
  },


  _onDocumentInserted: {
    observe: function(subject, topic, data) {
      var win = subject.defaultView;
      if (win === undefined) {
        // ??? resource://gre/modules/commonjs/sdk/system/events.js emit
        console.trace("win=undefined", subject, topic, data);
        return;
      }
      if (win !== null) { // xsl/xbl
        DocStartScriptInjection._initWindow(win);
      }
    },
  },


  _initWindow: function(win) {
    var me = DocStartScriptInjection;
    var innerId = UIUtils.getDOMUtils(win).currentInnerWindowID.toString();

    if (innerId in me._innerWindows) {
      console.trace("window already initialized", innerId, win.location.href);
      return;
    }

    var browser = UIUtils.findOriginBrowser(win);
    if (browser === null) {
      return;
    }

    if (win === win.top) {
      ErrorHandler.onNewWindow(browser);
    }

    if (Profile.isNativeProfile(Profile.getIdentity(browser))) {
      return;
    }

    switch (win.location.protocol) {
      case "http:":
      case "https:":
        break;
      default:
        return;
    }

    var sandbox = Cu.Sandbox(win, {sandboxName: "multifox-sandbox", wantComponents:false});
    sandbox.window = XPCNativeWrapper.unwrap(win);
    sandbox.document = XPCNativeWrapper.unwrap(win.document);
    sandbox.sendCmd = function(obj) {
      return cmdContent(obj, win.document);
    };

    try {
      // window.localStorage will be replaced by a Proxy object.
      // It seems it's only possible using a sandbox.
      Cu.evalInSandbox(me._src, sandbox);
    } catch (ex) {
      ErrorHandler.addScriptError(win, "sandbox", win.document.documentURI + " " + "//exception=" + ex);
      Cu.nukeSandbox(sandbox);
      return;
    }

    // keep a reference to Cu.nukeSandbox (Cu.getWeakReference won't work for that)
    me._innerWindows[innerId] = sandbox;
  }
};


function cmdContent(obj, contentDoc) {
  switch (obj.from) {
    case "cookie":
      return documentCookie(obj, contentDoc);
    case "localStorage":
      return windowLocalStorage(obj, contentDoc);
    case "error":
      ErrorHandler.addScriptError(contentDoc.defaultView, obj.cmd, "-");
      return undefined;
    default:
      throw obj.from;
  }
}
