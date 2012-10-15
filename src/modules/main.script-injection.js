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

    this._sentByChrome  = "multifox-chrome_event-"  + Math.random().toString(36).substr(2);
    this._sentByContent = "multifox-content_event-" + Math.random().toString(36).substr(2);
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
