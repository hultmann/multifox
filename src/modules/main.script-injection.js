/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Multifox.
 *
 * The Initial Developer of the Original Code is
 * Jeferson Hultmann <hultmann@gmail.com>
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

// Add hooks to documents (cookie, localStorage, ...)

function DocStartScriptInjection() {
  var info = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULAppInfo);
  var is192 = info.platformVersion.indexOf("1.9") === 0; // Gecko 1.9.2

  this._loader = new ScriptSourceLoader(is192);
  Cc["@mozilla.org/observer-service;1"]
    .getService(Ci.nsIObserverService)
    .addObserver(this, "content-document-global-created", false);
    // TODO (Gecko 2) "document-element-inserted"
}

DocStartScriptInjection.prototype = {
  stop: function() {
    Cc["@mozilla.org/observer-service;1"]
      .getService(Ci.nsIObserverService)
      .removeObserver(this, "content-document-global-created");
    delete this._loader;
  },

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver]),
  observe: function(win, topic, prePath) {
    if (win === null) {
      return;
    }

    if (prePath === "null") {
      return;
    }

    var idData = FindIdentity.fromContent(win);
    clearStatusIcon(idData, win);

    switch (idData.profileNumber) {
      case Profile.DefaultIdentity:
      case Profile.UnknownIdentity:
        return;
    }

    if (prePath.indexOf("http:") !== 0) {
      if (prePath.indexOf("https:") !== 0) {
        return;
      }
    }

    var sandbox = Components.utils.Sandbox(win);
    sandbox.window = win.wrappedJSObject;
    sandbox.document = win.document.wrappedJSObject;

    var src = this._loader.getScript();
    try {
      Components.utils.evalInSandbox(src, sandbox);
    } catch (ex) {
      showError(win, "sandbox", prePath + " " + "//exception=" + ex);
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


function ScriptSourceLoader(is192) {
  if (is192) {
    // Gecko 1.9.2
    this._path = "${URI_PACKAGENAME}/content/content-injection-192.js";
  } else {
    // Gecko 2.0
    this._path = "${URI_PACKAGENAME}/content/content-injection.js";
  }
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
      delete me._path;
      me._src = xhr.responseText + "initContext(window, document, '"
                                 + m_runner.eventSentByChrome + "','" + m_runner.eventSentByContent + "');";
    };
    xhr.open("GET", this._path, async);
    xhr.overrideMimeType("text/plain");
    xhr.send(null);
  }
};
