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

    var idData = FindIdentity.fromContent(win);
    clearStatusIcon(idData, win);

    switch (idData.profileNumber) {
      case Profile.DefaultIdentity:
      case Profile.UndefinedIdentity:
        return;
    }

    switch (subject.documentURIObject.scheme) {
      case "http":
      case "https":
        break;
      default:
        return;
    }

    var sandbox = Components.utils.Sandbox(win, {sandboxName: "multifox-content"});
    sandbox.window = win.wrappedJSObject;
    sandbox.document = win.document.wrappedJSObject;

    var src = this._loader.getScript();
    try {
      Components.utils.evalInSandbox(src, sandbox);
    } catch (ex) {
      showError(win, "sandbox", subject.documentURI + " " + "//exception=" + ex);
    }

  }
};


function clearStatusIcon(idData, win) {
  if (win !== win.top) {
    return;
  }
  var browser = idData.browserElement;
  if (!browser) {
    return;
  }
  var icon = getIconNode(browser.ownerDocument);
  if (icon === null) { // view-source?
    return;
  }
  var stat = icon.getAttribute("tab-status");
  if (stat.length === 0) {
    return;
  }

  var selBrowser = browser.getTabBrowser().selectedBrowser;
  if (selBrowser !== browser) {
    return;
  }
  browser.removeAttribute("multifox-tab-status");
  updateStatus(browser.ownerDocument);
}


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
