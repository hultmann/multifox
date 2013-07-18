/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var EXPORTED_SYMBOLS = ["xulCommand", "removeData", "menuButtonShowing"];

Components.utils.import("resource://gre/modules/Services.jsm");
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

  var enumWin = Services.wm.getEnumerator("navigator:browser");
  while (enumWin.hasMoreElements()) {
    var win2 = enumWin.getNext();
    if (Profile.getIdentity(win2) === newProfileId) {
      win2.focus();
      return;
    }
  }

  newPendingWindow(newProfileId);
  win.OpenBrowserWindow();
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
      updateButton(win2);
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
  var panel = doc.getElementById("mainPopupSet").appendChild(doc.createElement("panel"));
  panel.setAttribute("id", "multifox-popup");
  panel.setAttribute("type", "arrow");
  panel.openPopup(doc.getElementById("${CHROME_NAME}-button"), "bottomcenter topright");

  var container = panel.appendChild(doc.createElement("vbox"));
  container.style.margin = ".5ch .5ch";
  container.style.width = "40ch";

  var desc = container.appendChild(doc.createElement("description"));
  desc.appendChild(doc.createTextNode(util.getText("delete.text")));

  var container2 = container.appendChild(doc.createElement("hbox"));
  container2.setAttribute("pack", "end");
  var but = container2.appendChild(doc.createElement("button"));
  but.setAttribute("label", util.getText("delete.button.label"));
  but.setAttribute("command", "${CHROME_NAME}:cmd_delete_profile");
}


function removeData() {
  // TODO localStorage
  // cookies
  var list = getProfileList();
  for (var idx = list.length - 1; idx > -1; idx--) {
    removeProfile(list[idx]);
  }
}


function removeProfile(profileId) {
  console.assert(profileId > Profile.DefaultIdentity, "cannot remote DefaultIdentity, " + profileId);

  var h = ".multifox-profile-" + profileId;
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
  item.setAttribute("label", util.getText("button.new-profile.label"));
  item.setAttribute("accesskey", util.getText("button.new-profile.accesskey"));

  var list = getProfileList();
  if (list.length === 0) {
    return;
  }


  menupopup.appendChild(doc.createElement("menuseparator"));

  list = ProfileAlias.sort(list);
  var profileId = Profile.getIdentity(doc.defaultView);
  appendSelectWindowItems(menupopup, doc, profileId, list);
  if (profileId === Profile.DefaultIdentity) {
    return;
  }

  menupopup.appendChild(doc.createElement("menuseparator"));
  var menu = menupopup.appendChild(doc.createElement("menu"));
  setProfilePopup(menu, doc, list, profileId);
}


function appendSelectWindowItems(menupopup, doc, profileId, list) {
  var item = menupopup.appendChild(doc.createElement("menuitem"));
  item.setAttribute("label", ProfileAlias.format(Profile.DefaultIdentity));
  item.setAttribute("command", "${CHROME_NAME}:cmd_select_window");
  item.setAttribute("profile-id", Profile.DefaultIdentity);
  if (profileId === Profile.DefaultIdentity) {
    item.setAttribute("disabled", "true");
    item.removeAttribute("command");
  }

  for (var idx = 0; idx < list.length; idx++) {
    var label = ProfileAlias.format(list[idx]);
    if (profileId === list[idx]) {
      var menu = menupopup.appendChild(doc.createElement("menu"));
      menu.setAttribute("label", label);
      profilePopup(menu, doc, profileId);

    } else {
      item = menupopup.appendChild(doc.createElement("menuitem"));
      item.setAttribute("label", label);
      item.setAttribute("profile-id", list[idx]);
      item.setAttribute("command", "${CHROME_NAME}:cmd_select_window");
    }
  }
}



function setProfilePopup(menu, doc, list, profileId) {
  menu.setAttribute("label", util.getText("button.set-profile.label"));
  menu.setAttribute("accesskey", util.getText("button.set-profile.accesskey"));
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
}


function profilePopup(menu, doc, profileId) {
  var menupopup = menu.appendChild(doc.createElement("menupopup"));
  var item;

  item = menupopup.appendChild(doc.createElement("menuitem"));
  item.setAttribute("command", "${CHROME_NAME}:cmd_rename_profile_prompt");
  item.setAttribute("label", util.getText("button.rename-profile.label"));
  item.setAttribute("accesskey", util.getText("button.rename-profile.accesskey"));
  item.setAttribute("profile-id", profileId);

  item = menupopup.appendChild(doc.createElement("menuitem"));
  item.setAttribute("command", "${CHROME_NAME}:cmd_delete_profile_prompt");
  item.setAttribute("label", util.getText("button.delete-profile.label"));
  item.setAttribute("accesskey", util.getText("button.delete-profile.accesskey"));
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
    if (h.indexOf(".multifox-profile-") === -1) {
      continue;
    }
    var ns = h.substr(h.lastIndexOf(".") + 1);
    if (ns.startsWith("multifox-profile-")) {
      if (nsList.indexOf(ns) === -1) {
        nsList.push(ns);
      }
    }
  }

  for (var idx = nsList.length - 1; idx > -1; idx--) {
    var n = parseInt(nsList[idx].substr(17), 10);
    // 17="multifox-profile-".length
    if (Number.isNaN(n) === false) { // Fx15+
      list.push(n);
    }
  }

  console.log("getProfileList", new Date().getTime() - t0, list);
  return list;
}
