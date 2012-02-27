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
 * Portions created by the Initial Developer are Copyright (C) 2012
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
