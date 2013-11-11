/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var EXPORTED_SYMBOLS = ["xulCommand", "removeData", "menuButtonShowing", "migrateCookies"];

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/PrivateBrowsingUtils.jsm");
Components.utils.import("${PATH_MODULE}/new-window.js");
Components.utils.import("${PATH_MODULE}/main.js");


function xulCommand(evt) {
  var cmd = evt.target; // <command>
  var win = cmd.ownerDocument.defaultView.top;

  switch (cmd.getAttribute("id")) {
    case "${CHROME_NAME}:cmd_new_profile":
      newPendingWindow();
      win.OpenBrowserWindow();
      break;
    case "${CHROME_NAME}:cmd_delete_profile":
      deleteCurrentPopup(win);
      break;
    case "${CHROME_NAME}:cmd_delete_profile_prompt":
      showDeletePopup(win.document);
      break;
    case "${CHROME_NAME}:cmd_rename_profile_prompt":
      renameProfilePrompt(win, getProfileIdFromMenuItem(evt));
      break;
    case "${CHROME_NAME}:cmd_set_profile_window":
      Profile.defineIdentity(win, getProfileIdFromMenuItem(evt));
      break;
    case "${CHROME_NAME}:cmd_select_window":
      selectProfileWindow(win, evt);
      break;
    case "${CHROME_NAME}:cmd_show_error":
      showError(win);
      break;
    default:
      throw new Error("${EXT_NAME} - xul cmd unknown: " + cmd.getAttribute("id"));
  }
}


function getProfileIdFromMenuItem(evt) {
  var id = evt.explicitOriginalTarget.getAttribute("profile-id");
  return Profile.toInt(id);
}


function selectProfileWindow(win, evt) {
  var newProfileId = getProfileIdFromMenuItem(evt);
  var arr = getProfileWindows(newProfileId);
  if (arr.length === 0) {
    // New window
    if (newProfileId === Profile.PrivateIdentity) {
      win.document.getElementById("Tools:PrivateBrowsing").doCommand();
    } else {
      newPendingWindow(newProfileId);
      win.OpenBrowserWindow();
    }
    return;
  }

  // focus next window
  var idx = arr.indexOf(util.getOuterId(win)) + 1;
  if (idx > (arr.length - 1)) {
    idx = 0;
  }
  return Services.wm.getOuterWindowWithId(arr[idx]).focus();
}


function getProfileWindows(profileId) {
  var arr = [];

  var enumWin = Services.wm.getEnumerator("navigator:browser");
  while (enumWin.hasMoreElements()) {
    var win = enumWin.getNext();
    if (Profile.getIdentity(win) === profileId) {
      arr.push(util.getOuterId(win));
    }
  }

  arr.sort(function(a, b) {
    return a - b;
  });
  return arr;
}


function renameProfilePrompt(win, profileId) {
  var title = util.getText("dialog.rename.title", "${EXT_NAME}");
  var desc = util.getText("dialog.rename.label", profileId);
  var newName = {value: ProfileAlias.hasAlias(profileId)
                      ? ProfileAlias.format(profileId) : ""};
  if (Services.prompt.prompt(win, title, desc, newName, null, {value:false}) === false) {
    return;
  }

  ProfileAlias.rename(profileId, newName.value);

  var enumWin = Services.wm.getEnumerator("navigator:browser");
  while (enumWin.hasMoreElements()) {
    var win2 = enumWin.getNext();
    if (Profile.getIdentity(win2) === profileId) {
      var winId = util.getOuterId(win2).toString();
      Services.obs.notifyObservers(null, "${BASE_DOM_ID}-id-changed", winId);
    }
  }
}


function deleteCurrentPopup(win) {
  var profileId = Profile.getIdentity(win);

  var enumWin = Services.wm.getEnumerator("navigator:browser");
  while (enumWin.hasMoreElements()) {
    var win2 = enumWin.getNext();
    if (Profile.getIdentity(win2) === profileId) {
      win2.close();
    }
  }

  removeProfile(profileId);
  ProfileAlias.remove(profileId);
}


function showDeletePopup(doc) {
  var container = createArrowPanel(doc, "warning");

  var desc = container.appendChild(doc.createElement("description"));
  desc.appendChild(doc.createTextNode(util.getText("delete.text", "${EXT_NAME}")));

  var container2 = container.appendChild(doc.createElement("hbox"));
  container2.setAttribute("pack", "end");
  var but = container2.appendChild(doc.createElement("button"));
  but.setAttribute("label", util.getText("delete.button.label"));
  but.setAttribute("command", "${CHROME_NAME}:cmd_delete_profile");
}


function showError(win) {
  var doc = win.document;
  var container;
  var msg;

  switch (ErrorHandler.getCurrentError(doc)) {
    case "incompatible-extension":
      ExtCompat.findIncompatibleExtensions(function(arr) {
        for (var idx = 0; idx < arr.length; idx++) {
          var desc = container.appendChild(doc.createElement("description"));
          desc.setAttribute("style", "font-weight:bold");
          desc.appendChild(doc.createTextNode(arr[idx]));
        }
      });
      msg = util.getText("icon.error-panel.extension.label", "${EXT_NAME}");
      break;
    case "www-authenticate":
    case "authorization":
      msg = util.getText("icon.error-panel.unsupported-feature.label", "${EXT_NAME}", "HTTP Basic authentication");
      break;
    case "indexedDB":
      msg = util.getText("icon.error-panel.unsupported-feature.label", "${EXT_NAME}", "indexedDB");
      break;
    case "sandbox":
      msg = util.getText("icon.error-panel.sandbox.label", "${EXT_NAME}");
      break;
    default:
      if (PrivateBrowsingUtils.permanentPrivateBrowsing) {
        msg = '${EXT_NAME} won\'t work if "Never remember history" or "Always use private browsing mode" are enabled (Options>Privacy).';
      } else {
        msg = ErrorHandler.getCurrentError(doc);
      }
      break;
  }

  container = createArrowPanel(doc, "error");
  var desc = container.appendChild(doc.createElement("description"));
  desc.appendChild(doc.createTextNode(msg));
}


function createArrowPanel(doc, icon) {
  var panel = doc.getElementById("mainPopupSet").appendChild(doc.createElement("panel"));
  panel.setAttribute("type", "arrow");

  var container = panel.appendChild(doc.createElement("hbox"));
  var col1 = container.appendChild(doc.createElement("vbox"));
  var img = col1.appendChild(doc.createElement("image"));
  switch (icon) {
    case "warning":
      img.setAttribute("src", "chrome://global/skin/icons/warning-large.png");
      break;
    case "error":
      img.setAttribute("src", "chrome://global/skin/icons/error-48.png");
      break;
    default:
      throw new Error("createArrowPanel", icon);
  }

  var col2 = container.appendChild(doc.createElement("vbox"));
  col2.setAttribute("flex", "1");
  col2.setAttribute("style", "margin:.5ch .5ch; width:40ch");

  panel.openPopup(doc.getElementById("${CHROME_NAME}-button"), "bottomcenter topright");
  return col2;
}


function removeData() {
  // TODO localStorage
  // cookies
  var list = getProfileList();
  for (var idx = list.length - 1; idx > -1; idx--) {
    removeProfile(list[idx]);
  }
  ButtonPersistence.removeButton("${CHROME_NAME}-button");

  // remove error attributes
  var enumWin = Services.wm.getEnumerator("navigator:browser");
  while (enumWin.hasMoreElements()) {
    var tabbrowser = enumWin.getNext().getBrowser();
    for (idx = tabbrowser.length - 1; idx > -1; idx--) {
      var browser = tabbrowser.browsers[idx];
      browser.removeAttribute("multifox-tab-error-script");
      browser.removeAttribute("multifox-tab-error-net");
    }
  }
}


function removeProfile(profileId) {
  console.assert(Profile.isExtensionProfile(profileId), "cannot remove native profile", profileId);

  var h = "-" + profileId + ".multifox";
  var myCookies = [];
  var COOKIE = Ci.nsICookie2;
  var mgr = Services.cookies;
  var all = mgr.enumerator;

  while (all.hasMoreElements()) {
    var cookie = all.getNext().QueryInterface(COOKIE);
    if (cookie.host.endsWith(h)) {
      myCookies.push(cookie);
    }
  }

  for (var idx = myCookies.length - 1; idx > -1; idx--) {
    cookie = myCookies[idx];
    mgr.remove(cookie.host, cookie.name, cookie.path, false);
  }
}


function migrateCookies() {
  var nsList = [];
  var COOKIE = Ci.nsICookie2;
  var cookie;
  var mgr = Services.cookies;
  var myHost;

  // collect cookies
  var all = mgr.enumerator;
  while (all.hasMoreElements()) {
    cookie = all.getNext().QueryInterface(COOKIE);
    myHost = cookie.host;
    if (myHost.indexOf(".multifox-profile-") === -1) {
      continue;
    }
    var ns = myHost.substr(myHost.lastIndexOf(".") + 1);
    if (ns.startsWith("multifox-profile-")) {
      nsList.push(cookie);
    }
  }

  // remove them
  for (var idx = nsList.length - 1; idx > -1; idx--) {
    cookie = nsList[idx];
    mgr.remove(cookie.host, cookie.name, cookie.path, false);
  }

  // convert cookies to new host
  for (var idx = nsList.length - 1; idx > -1; idx--) {
    cookie = nsList[idx];
    myHost = cookie.host;
    var idxLastDot = myHost.lastIndexOf(".");
    var realHost = myHost.substr(0, idxLastDot);
    // 17="multifox-profile-".length
    var profileId = parseInt(myHost.substr(idxLastDot + 1).substr(17), 10);
    if (Number.isNaN(profileId)) {
      continue;
    }

    var newHost = cookieInternalDomain(realHost, profileId);
    mgr.add(newHost, cookie.path, cookie.name, cookie.value,
            cookie.isSecure, cookie.isHttpOnly, cookie.isSession, cookie.expiry);
  }
}



// menupopup show/hide


function onPopupHidden(evt) {
  var menupopup = evt.currentTarget;
  if (menupopup !== evt.target) {
    return;
  }
  menupopup.removeEventListener("popuphidden", onPopupHidden, false);

  while (menupopup.firstChild) {
    menupopup.removeChild(menupopup.firstChild);
  };
}


function menuButtonShowing(menupopup) {
  menupopup.addEventListener("popuphidden", onPopupHidden, false);
  var doc = menupopup.ownerDocument;

  var item = menupopup.appendChild(doc.createElement("menuitem"));
  item.setAttribute("command", "${CHROME_NAME}:cmd_new_profile");
  item.setAttribute("key", "key_${BASE_DOM_ID}-new-identity");
  item.setAttribute("label", util.getText("button.menuitem.new.label"));
  item.setAttribute("accesskey", util.getText("button.menuitem.new.accesskey"));
  if (PrivateBrowsingUtils.permanentPrivateBrowsing) {
    item.setAttribute("disabled", "true");
    item.removeAttribute("command");
  }

  var list = getProfileList();

  // TODO var profiles = Profile.activeIdentities(win);
  // show profileId from all windows even if it's not in the profile list
  var enumWin = Services.wm.getEnumerator("navigator:browser");
  while (enumWin.hasMoreElements()) {
    var id = Profile.getIdentity(enumWin.getNext());
    if (Profile.isExtensionProfile(id)) {
      if (list.indexOf(id) === -1) {
        list.push(id);
      }
    }
  }

  appendDefaultItems(menupopup, profileId);

  list = ProfileAlias.sort(list); // sort formatted IDs
  var profileId = Profile.getIdentity(doc.defaultView);
  if (list.length > 0) {
    appendProfileList(menupopup, list, profileId);
  }
  appendCurrentProfileMenu(menupopup, list, profileId);

  if (PrivateBrowsingUtils.permanentPrivateBrowsing ||
     (ErrorHandler.getCurrentError(doc).length > 0)) {
    appendErrorItem(menupopup);
  }
}


function appendErrorItem(menupopup) {
  var doc = menupopup.ownerDocument;

  menupopup.appendChild(doc.createElement("menuseparator"));
  var item = menupopup.appendChild(doc.createElement("menuitem"));
  item.setAttribute("command", "${CHROME_NAME}:cmd_show_error");
  item.setAttribute("label", util.getText("button.menuitem.error.label"));
  item.setAttribute("accesskey", util.getText("button.menuitem.error.accesskey"));
  item.setAttribute("image", "chrome://global/skin/icons/error-16.png");
  item.classList.add("menuitem-iconic");
}


function appendDefaultItems(menupopup, profileId) {
  var doc = menupopup.ownerDocument;

  menupopup.appendChild(doc.createElement("menuseparator"));
  var item = menupopup.appendChild(doc.createElement("menuitem"));

  item.setAttribute("label", ProfileAlias.format(Profile.DefaultIdentity));
  item.setAttribute("command", "${CHROME_NAME}:cmd_select_window");
  item.setAttribute("profile-id", Profile.DefaultIdentity);
  if (PrivateBrowsingUtils.permanentPrivateBrowsing) {
    item.setAttribute("disabled", "true");
    item.removeAttribute("command");
  }

  var item2 = menupopup.appendChild(doc.createElement("menuitem"));
  item2.setAttribute("label", ProfileAlias.format(Profile.PrivateIdentity));
  item2.setAttribute("command", "${CHROME_NAME}:cmd_select_window");
  item2.setAttribute("profile-id", Profile.PrivateIdentity);

  if (Profile.isExtensionProfile(profileId)) {
    return;
  }

  var current = PrivateBrowsingUtils.isWindowPrivate(doc.defaultView) ? item2 : item;
  current.setAttribute("type", "radio");
  current.setAttribute("checked", "true");
}


function appendProfileList(menupopup, list, profileId) {
  var doc = menupopup.ownerDocument;

  menupopup.appendChild(doc.createElement("menuseparator"));

  for (var idx = 0; idx < list.length; idx++) {
    var item = menupopup.appendChild(doc.createElement("menuitem"));
    if (profileId === list[idx]) {
      item.setAttribute("type", "radio");
      item.setAttribute("checked", "true");
    }
    item.setAttribute("label", ProfileAlias.format(list[idx]));
    item.setAttribute("profile-id", list[idx]);
    item.setAttribute("command", "${CHROME_NAME}:cmd_select_window");
    if (PrivateBrowsingUtils.permanentPrivateBrowsing) {
      item.setAttribute("disabled", "true");
      item.removeAttribute("command");
    }
  }
}


function appendCurrentProfileMenu(menupopup, list, profileId) {
  var doc = menupopup.ownerDocument;

  menupopup.appendChild(doc.createElement("menuseparator"));
  var menu = menupopup.appendChild(doc.createElement("menu"));

  if (Profile.isNativeProfile(profileId)) {
    menu.setAttribute("disabled", "true");
  }

  menu.setAttribute("label", util.getText("button.menuitem.edit.label"));
  menu.setAttribute("accesskey", util.getText("button.menuitem.edit.accesskey"));
  var menupopup = menu.appendChild(doc.createElement("menupopup"));

  for (var idx = 0; idx < list.length; idx++) {
    var item = menupopup.appendChild(doc.createElement("menuitem"));
    item.setAttribute("label", ProfileAlias.format(list[idx]));
    item.setAttribute("profile-id", list[idx]);
    item.setAttribute("command", "${CHROME_NAME}:cmd_set_profile_window");
    if (profileId === list[idx]) {
      item.removeAttribute("command");
      item.setAttribute("type", "radio");
      item.setAttribute("checked", "true");
    }
  }

  menupopup.appendChild(doc.createElement("menuseparator"));
  profilePopup(menupopup, doc, profileId);
}


function profilePopup(menupopup, doc, profileId) {
  var item;

  item = menupopup.appendChild(doc.createElement("menuitem"));
  item.setAttribute("command", "${CHROME_NAME}:cmd_rename_profile_prompt");
  item.setAttribute("label", util.getText("button.menuitem.rename.label"));
  item.setAttribute("accesskey", util.getText("button.menuitem.rename.accesskey"));
  item.setAttribute("profile-id", profileId);

  item = menupopup.appendChild(doc.createElement("menuitem"));
  item.setAttribute("command", "${CHROME_NAME}:cmd_delete_profile_prompt");
  item.setAttribute("label", util.getText("button.menuitem.delete.label"));
  item.setAttribute("accesskey", util.getText("button.menuitem.delete.accesskey"));
  item.setAttribute("profile-id", profileId);
}


function getProfileList() {
  var t0 = new Date().getTime();
  var list = [];
  var nsList = [];

  var all = Services.cookies.enumerator;
  var COOKIE = Ci.nsICookie2;
  while (all.hasMoreElements()) {
    var h = all.getNext().QueryInterface(COOKIE).host;
    if (h.endsWith(".multifox") === false) {
      continue;
    }
    var ns = h.substr(h.lastIndexOf("-") + 1);
    if (nsList.indexOf(ns) === -1) {
      nsList.push(ns); // "2.multifox"
    }
  }

  for (var idx = nsList.length - 1; idx > -1; idx--) {
    var n = parseInt(nsList[idx].replace(".multifox", ""), 10);
    if (Number.isNaN(n) === false) { // Fx15+
      list.push(n);
    }
  }

  console.log("getProfileList", new Date().getTime() - t0, list);
  return list;
}
