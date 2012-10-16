/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


function registerAbout() {
  Components.manager.QueryInterface(Ci.nsIComponentRegistrar).registerFactory(
    Components.ID("${XPCOM_ABOUT_CLASS}"),
    "about multifox",
    "${XPCOM_ABOUT_CONTRACT}",
    AboutMultifoxFactory);
}


function unregisterAbout() {
  Components.manager.QueryInterface(Ci.nsIComponentRegistrar).unregisterFactory(
    Components.ID("${XPCOM_ABOUT_CLASS}"),
    AboutMultifoxFactory);
}


var AboutMultifoxFactory = {
  createInstance: function(outer, iid) {
    if (outer !== null) {
      throw Components.resources.NS_ERROR_NO_AGGREGATION;
    }
    return AboutMultifoxImpl.QueryInterface(iid);
  }
};


var AboutMultifoxImpl = {
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIAboutModule]),
  getURIFlags: function(uri) {
    return Ci.nsIAboutModule.ALLOW_SCRIPT;
  },
  newChannel: function(uri) {
    var channel = Services.io.newChannel("${PATH_CONTENT}/about-multifox.html", null, null);
    channel.originalURI = uri;
    return channel;
  }
};
