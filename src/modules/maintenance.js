/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

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
