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

"use strict";


function install() {
  var branch = Services.prefs.getBranch("extensions.${EXT_ID}.");

  var prefName = "currentVersion";
  var ver = branch.prefHasUserValue(prefName) ? branch.getCharPref(prefName) : null;
  if (ver === "${EXT_VERSION}") {
    return;
  }
  if (ver !== null) {
    migrate(); // ver=null ==> there is nothing to migrate
  }
  branch.setCharPref(prefName, "${EXT_VERSION}");
}


function uninstall() {
  removePrefs();
  removeExtCookies();
  removeTabAttributes();
}


function migrate() {
  // TODO ss.deleteWindowValue(doc.defaultView, "*-identity-id");

  // remove Multifox 1.x cookies
  var profileId = 2;
  var all;
  do {
    all = removeTldData_cookies("multifox-profile-" + profileId);
    console.log("Migrating: removing cookies 1.x", profileId, ":", all.length);
    profileId++;
  } while ((profileId < 20) || (all.length > 0));


  // remove Multifox 2.x beta 1 cookies
  all = removeTldData_cookies("x-content.x-namespace");
  console.log("Migrating: removing cookies 2.0b1", all.length);

  // remove Multifox 2.x beta 2 cookies
  all = removeTldData_cookies("-.x-namespace");
  console.log("Migrating: removing cookies 2.0b2", all.length);

  // remove Multifox 2.x beta 3 cookies
  //all = removeTldData_cookies("multifox-auth-1");
  //var all2 = removeTldData_cookies("multifox-anon-1");
  //console.log("Migrating: removing cookies 2.0b3", all.length + all2.length);
}


function removePrefs() {
  Services.prefs.getBranch("extensions.${EXT_ID}.").deleteBranch("");
}


function removeExtCookies() {
  removeTldData_cookies("${INTERNAL_DOMAIN_SUFFIX_LOGGEDIN}");
  removeTldData_cookies("${INTERNAL_DOMAIN_SUFFIX_ANON}");
}


function removeTabAttributes() {
  var attrs = [
    "multifox-tab-logins",
    "multifox-tab-id-provider-tld-enc",
    "multifox-tab-id-provider-user-enc",
    "multifox-tab-current-tld",
    "multifox-tab-previous-tld",
    "multifox-tab-error",
    "multifox-cross-login-commited-wait-landing-page",
    "multifox-invalidate-icon",
    "multifox-logging-in",
    "multifox-login-submit-data-moved",
    "multifox-login-submit-domain",
    "multifox-login-submit-user",
    "multifox-redir-invalidate"
  ];

  var enumWin = UIUtils.getWindowEnumerator();
  while (enumWin.hasMoreElements()) {
    var win = enumWin.getNext();
    win.document.documentElement.removeAttribute("multifox-window-uninitialized");

    var tabList = UIUtils.getTabList(win);
    for (var idxTab = tabList.length - 1; idxTab > -1; idxTab--) {
      var tab = tabList[idxTab];
      for (var idxAttr = attrs.length - 1; idxAttr > -1; idxAttr--) {
        tab.removeAttribute(attrs[idxAttr]);
      }
    }
  }
}
