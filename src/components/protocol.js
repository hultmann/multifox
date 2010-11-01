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

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");


function AboutMultifox() {}

AboutMultifox.prototype = {
  classDescription: "about multifox",
  contractID: "${XPCOM_ABOUT_CONTRACT}",
  classID: Components.ID("${XPCOM_ABOUT_CLASS}"),

  QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsIAboutModule]),
  getURIFlags: function(aURI) {
    return Components.interfaces.nsIAboutModule.ALLOW_SCRIPT;
  },
  newChannel: function(aURI) {
    var channel = Components.classes["@mozilla.org/network/io-service;1"]
                    .getService(Components.interfaces.nsIIOService)
                    .newChannel("${URI_PACKAGENAME}/content/about-multifox.html", null, null);
    channel.originalURI = aURI;
    return channel;
  }
};



function Startup() {}

Startup.prototype = {
  classDescription: "multifox bg",
  contractID: "${XPCOM_STARTUP_CONTRACT}",
  classID: Components.ID("${XPCOM_STARTUP_CLASS}"),
  _xpcom_categories: [{category: "profile-after-change"}],

  QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsIObserver]),
  observe: function(subject, topic, data) {
    if (topic === "profile-after-change") {
      var ns = {};
      Components.utils.import("${URI_JS_MODULE}/new-window.js", ns);
      ns.init();
    }
  }
};



if (XPCOMUtils.generateNSGetFactory) {
  var NSGetFactory = XPCOMUtils.generateNSGetFactory([AboutMultifox, Startup]); // Gecko 2
} else {
  var NSGetModule = XPCOMUtils.generateNSGetModule([AboutMultifox, Startup]);   // Gecko 1.9.2
}
