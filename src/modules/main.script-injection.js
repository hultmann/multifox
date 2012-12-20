/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Add hooks to documents (cookie, localStorage, ...)

var DocOverlay = {
  _loader: null,
  _sentByChrome: null,
  _sentByContent: null,

  init: function() {
    this._loader = new ScriptSourceLoader();

    var branch = Services.prefs.getBranch("extensions.${EXT_ID}.");
    var prefName = "contentEvents";
    if (branch.prefHasUserValue(prefName)) {
      var names = branch.getCharPref(prefName).split(" ");
      if (names.length === 2) {
        this._sentByChrome = names[0];
        this._sentByContent = names[1];
        return;
      }
    }

    this._sentByChrome  = "${BASE_ID}-chrome_event-"  + Math.random().toString(36).substr(2);
    this._sentByContent = "${BASE_ID}-content_event-" + Math.random().toString(36).substr(2);
    branch.setCharPref(prefName, this._sentByChrome + " " + this._sentByContent);
  },


  getInitBrowserData: function() {
    var me = this;
    return {
      src:           me._loader.getScript(),
      sentByChrome:  me._sentByChrome,
      sentByContent: me._sentByContent
    };
  }
};


function ScriptSourceLoader() { // TODO move to DocOverlay
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
      me._src = xhr.responseText;
    };
    xhr.open("GET", "${PATH_CONTENT}/content-injection.js", async);
    xhr.overrideMimeType("text/plain");
    xhr.send(null);
  }
};
