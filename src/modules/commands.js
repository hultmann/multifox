/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var EXPORTED_SYMBOLS = ["windowCommand", "renderMenu", "removeData"];

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/PrivateBrowsingUtils.jsm");
Components.utils.import("resource://gre/modules/ShortcutUtils.jsm");
Components.utils.import("${PATH_MODULE}/new-window.js");
Components.utils.import("${PATH_MODULE}/main.js");


function windowCommand(evt, elem, cmd, param) {
  var win = elem.ownerDocument.defaultView.top;
  switch (cmd) {
    case "cmd_new_profile":
      if (PrivateBrowsingUtils.permanentPrivateBrowsing) {
        return;
      }
      newPendingWindow();
      win.OpenBrowserWindow();
      break;
    case "cmd_delete_profile":
      deleteCurrentPopup(win);
      break;
    case "cmd_delete_profile_prompt":
      showDeletePopup(win.document);
      break;
    case "cmd_rename_profile_prompt":
      renameProfilePrompt(win, Number.parseInt(param, 10));
      break;
    case "cmd_set_profile_window":
      Profile.defineIdentity(win, Number.parseInt(param, 10));
      break;
    case "cmd_select_window":
      selectProfileWindow(win, Number.parseInt(param, 10));
      break;
    case "cmd_show_error":
      showError(win);
      break;
    case "toggle-edit":
      evt.preventDefault();
      var deck = evt.target.ownerDocument.getElementById("${CHROME_NAME}-view-deck");
      deck.selectedIndex = deck.selectedIndex === "1" ? "0" : "1";
      break;
    default:
      throw new Error("${EXT_NAME} - cmd unknown: " + cmd);
  }
}


function selectProfileWindow(win, newProfileId) {
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
  // TODO reword dialog.rename.label:
  //     Choose a name for profile %1$S. Leave empty to use “%1$S”.
  // ==> Choose a name for %1$S. Leave empty to use “%2$S”.
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
  but.setAttribute("oncommand", formatCallCommand("cmd_delete_profile"));
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
  var fragment = doc.createDocumentFragment();
  var panel = fragment.appendChild(doc.createElement("panel"));
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


  var button;
  var placement = Components.utils.import("resource:///modules/CustomizableUI.jsm", {})
                 .CustomizableUI.getPlacementOfWidget("${CHROME_NAME}-button");
  if ((placement === null) || (placement.area === "PanelUI-contents")) {
    button = doc.getElementById("PanelUI-button");
  } else {
    button = doc.getElementById("${CHROME_NAME}-button");
  }

  doc.getElementById("mainPopupSet").appendChild(fragment);
  panel.openPopup(button, "bottomcenter topright");
  return col2;
}


function removeData() {
  // TODO localStorage
  // cookies
  var list = getProfileList();
  for (var idx = list.length - 1; idx > -1; idx--) {
    removeProfile(list[idx]);
  }

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


function renderMenu(doc) {
  var fragment = doc.createDocumentFragment();
  appendNew(fragment);

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

  list = ProfileAlias.sort(list); // sort formatted IDs
  var profileId = Profile.getIdentity(doc.defaultView);
  appendList(fragment, list, profileId);

  var fragment2 = doc.createDocumentFragment();
  panelEdit(fragment2, list, profileId);


  var panelView = doc.getElementById("${CHROME_NAME}-view-panel");

  var h = panelView.appendChild(doc.createElement("label"));
  h.classList.add("panel-subview-header");
  h.setAttribute("value", "${EXT_NAME}");


  var deck = panelView.appendChild(doc.createElement("deck"));
  deck.setAttribute("id", "${CHROME_NAME}-view-deck");
  deck.setAttribute("flex", "1"); // panel won't shrink
  deck.selectedIndex = "0";

  var ph = deck.appendChild(doc.createElement("vbox"));
  ph.classList.add("panel-subview-body");
  ph.appendChild(fragment);

  var ph = deck.appendChild(doc.createElement("vbox"));
  ph.classList.add("panel-subview-body");
  ph.appendChild(fragment2);
}


function appendNew(fragment) {
  var item = appendButton(fragment, util.getText("button.menuitem.new.label"));
  var keyId = "key_${BASE_DOM_ID}-new-identity";
  var key = fragment.ownerDocument.getElementById(keyId);
  item.setAttribute("key", keyId);
  item.setAttribute("shortcut", ShortcutUtils.prettifyShortcut(key));
  item.setAttribute("oncommand", formatCallCommand("cmd_new_profile"));
  if (PrivateBrowsingUtils.permanentPrivateBrowsing) {
    item.setAttribute("disabled", "true");
  }
}


function appendList(fragment, list, profileId) {
  appendSeparator(fragment);
  appendMenuItem(fragment, Profile.DefaultIdentity, profileId);
  var item = appendButton(fragment, ProfileAlias.format(Profile.PrivateIdentity));
  item.setAttribute("oncommand", formatCallCommand("cmd_select_window", Profile.PrivateIdentity));

  if (PrivateBrowsingUtils.isWindowPrivate(fragment.ownerDocument.defaultView)) {
    item.setAttribute("type", "radio");
    item.setAttribute("checked", "true");
  }

  if (list.length > 0) {
    appendSeparator(fragment);
    for (var idx = 0, len = list.length; idx < len; idx++) {
      appendMenuItem(fragment, list[idx], profileId);
    }
  }

  var doc = fragment.ownerDocument;
  if (PrivateBrowsingUtils.permanentPrivateBrowsing ||
     (ErrorHandler.getCurrentError(doc).length > 0)) {
    appendSeparator(fragment);
    var item = appendButton(fragment, util.getText("button.menuitem.error.label"));
    item.setAttribute("image", "chrome://global/skin/icons/error-16.png");
    item.setAttribute("oncommand", formatCallCommand("cmd_show_error"));
  }
}


function appendMenuItem(fragment, id, profileId) {
  var name = ProfileAlias.format(id);
  if (PrivateBrowsingUtils.permanentPrivateBrowsing) {
    appendButton(fragment, name).setAttribute("disabled", "true");
    return;
  }

  var cmd = formatCallCommand("cmd_select_window", id);

  if (id !== profileId) {
    appendButton(fragment, name).setAttribute("oncommand", cmd);
    return;
  }

  var items = fragment.appendChild(fragment.ownerDocument.createElement("toolbaritem"));

  var item = appendButton(items, name);
  item.setAttribute("type", "radio");
  item.setAttribute("checked", "true");
  item.setAttribute("flex", "1");
  item.setAttribute("oncommand", cmd);

  appendButton(items, util.getText("button.menuitem.edit.label"))
    .setAttribute("onclick", formatCallCommand("toggle-edit"));
}


function panelEdit(fragment, list, profileId) {
  var item;

  item = appendButton(fragment, String.fromCharCode(0x2190)); // ←
  item.setAttribute("onclick", formatCallCommand("toggle-edit"));

  appendSeparator(fragment);

  item = appendButton(fragment, util.getText("button.menuitem.rename.label"));
  item.setAttribute("oncommand", formatCallCommand("cmd_rename_profile_prompt", profileId));

  item = appendButton(fragment, util.getText("button.menuitem.delete.label"));
  item.setAttribute("oncommand", formatCallCommand("cmd_delete_profile_prompt", profileId));
  if (Profile.isExtensionProfile(profileId) === false) {
    item.setAttribute("disabled", "true");
  }

  appendSeparator(fragment);

  for (var idx = 0; idx < list.length; idx++) {
    var item = appendButton(fragment, ProfileAlias.format(list[idx]));
    item.setAttribute("oncommand", formatCallCommand("cmd_set_profile_window", list[idx]));
    if (profileId === list[idx]) {
      item.removeAttribute("oncommand");
      item.setAttribute("type", "radio");
      item.setAttribute("checked", "true");
    }
    if (Profile.isExtensionProfile(profileId) === false) {
      item.setAttribute("disabled", "true");
    }
  }
}


function formatCallCommand(...args) {
  return [
    "Components.utils.import('${PATH_MODULE}/commands.js',{})",
    ".windowCommand(event,this,'" + args.join("','") + "')"
  ].join("");
}


function appendButton(node, label) {
  var elem = node.appendChild(node.ownerDocument.createElement("toolbarbutton"));
  elem.setAttribute("label", label);
  elem.classList.add("subviewbutton");
  return elem;
}


function appendSeparator(node) {
  node.appendChild(node.ownerDocument.createElement("toolbarseparator"));
}


function getProfileList() {
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

  return list;
}
