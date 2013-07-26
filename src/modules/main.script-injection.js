/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


// Add hooks to documents (cookie, localStorage, ...)

function DocStartScriptInjection() {
  this._loader = new ScriptSourceLoader();
  Services.obs.addObserver(this, "document-element-inserted", false);
}

DocStartScriptInjection.prototype = {
  stop: function() {
    Services.obs.removeObserver(this, "document-element-inserted");
    delete this._loader;
  },

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver]),
  observe: function(subject, topic, data) {
    var win = subject.defaultView;
    if (win === null) {
      return; // xsl/xbl
    }


    var winInfo = FindIdentity.fromContent(win);
    if (Profile.isNativeProfile(winInfo.profileNumber)) {
      return;
    }

    if (winInfo.browserElement) {
      ErrorHandler.onNewWindow(win, winInfo.browserElement);
    }

    switch (subject.documentURIObject.scheme) {
      case "http":
      case "https":
        break;
      default:
        return;
    }

    var sandbox = Cu.Sandbox(win, {sandboxName: "multifox-content"});
    sandbox.window = win.wrappedJSObject;
    sandbox.document = win.document.wrappedJSObject;

    var src = this._loader.getScript();
    try {
      Cu.evalInSandbox(src, sandbox);
    } catch (ex) {
      ErrorHandler.addScriptError(win, "sandbox", subject.documentURI + " " + "//exception=" + ex);
    }

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
                                 + m_runner.eventSentByChrome + "','" + m_runner.eventSentByContent + "');";
    };
    xhr.open("GET", "${PATH_CONTENT}/content-injection.js", async);
    xhr.overrideMimeType("text/plain");
    xhr.send(null);
  }
};
