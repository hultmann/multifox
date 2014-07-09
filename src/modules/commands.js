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
      openNewProfileTab(win);
      break;
    case "cmd_delete_profile":
      deleteCurrentPopup(win);
      break;
    case "cmd_delete_profile_prompt":
      showDeletePopup(win.document);
      break;
    case "cmd_rename_profile_prompt":
      renameProfilePrompt(win, Profile.toInt(param));
      break;
    case "cmd_set_profile_tab":
      var browser = UIUtils.getSelectedTab(win).linkedBrowser;
      Profile.defineIdentity(browser, Profile.toInt(param));
      reloadTab(browser);
      var winId = util.getOuterId(win).toString();
      Services.obs.notifyObservers(null, "${BASE_DOM_ID}-id-changed", winId);
      break;
    case "cmd_select_tab":
      openOrSelectTab(win, Profile.toInt(elem.getAttribute("profile-id")));
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


function handleMiddleClick(evt) {
  if ((evt.button !== 1) || (evt.detail !== 1)) {
    // allow only middle clicks/single clicks
    return;
  }

  var button = evt.target;
  if (button.localName !== "toolbarbutton") {
    return;
  }

  if (button.hasAttribute("disabled") && (button.getAttribute("disabled") === "true")) {
    // ignore disabled items
    return;
  }
  if (button.hasAttribute("profile-id") === false) {
    return;
  }

  findParentPanel(button).hidePopup();

  var win = button.ownerDocument.defaultView;
  var id = button.getAttribute("profile-id");
  if (id.length > 0) {
    openTab(Profile.toInt(id), win);
  } else {
    openNewProfileTab(win);
  }
}


function reloadTab(browser) {
  var win = browser.contentWindow;
  switch (win.location.protocol) {
    case "http:":
    case "https:":
      break;
    default:
      return;
  }

  var channel = win.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIWebNavigation)
                   .QueryInterface(Ci.nsIDocShell).currentDocumentChannel
                   .QueryInterface(Ci.nsIHttpChannel);

  if (channel.requestMethod === "POST") {
    browser.loadURI(win.location.href); // avoid POST prompt
  } else {
    browser.reload();
  }
}


function openOrSelectTab(win, newProfileId) {
  var allTabs = getTabs();

  var len = allTabs.length;
  var selectableTabs = new Array(len);
  var currentTab = UIUtils.getSelectedTab(win);
  var noTabs = true;
  var idxCurrent = -1;

  for (var idx = 0; idx < len; idx++) {
    selectableTabs[idx] = null; // TODO Fx31: selectableTabs.fill(null);
    var tab = allTabs[idx];
    var isCurrent = tab === currentTab;
    if (isCurrent) {
      idxCurrent = idx;
    }
    if (Profile.getIdentity(tab.linkedBrowser) === newProfileId) {
      if (isCurrent === false) {
        noTabs = false;
        selectableTabs[idx] = tab;
      }
    }
  }

  if (noTabs) {
    if (Profile.getIdentity(UIUtils.getSelectedTab(win).linkedBrowser) !== newProfileId) {
      openTab(newProfileId, win);
    } // else { do nothing }
    return;
  }


  // there are tabs to select
  // [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
  //             last^
  //                  first^
  //                    ^idxCurrent (ignored)
  for (var idx = idxCurrent + 1, counter = 1; counter < len; idx++, counter++) {
    if (idx >= len) {
      idx = 0;
    }
    if (selectableTabs[idx] !== null) {
      selectTab(selectableTabs[idx]);
      return;
    }
  }

  throw new Error("openOrSelectTab");
}


function openNewProfileTab(win) {
  if (PrivateBrowsingUtils.permanentPrivateBrowsing) {
    return;
  }
  queueNewProfile(Profile.lowerAvailableId());
  win.BrowserOpenTab();
}


function openTab(newProfileId, win) {
  if (newProfileId === Profile.PrivateIdentity) {
    // New window
    win.document.getElementById("Tools:PrivateBrowsing").doCommand();
    return;
  }

  queueNewProfile(newProfileId);

  if (PrivateBrowsingUtils.isWindowPrivate(win) === false) {
    win.BrowserOpenTab(); // open tab
    return;
  }

  // current window is private, find a non-private one
  for (var winId of getSortedWindows()) {
    var win2 = Services.wm.getOuterWindowWithId(winId);
    if (PrivateBrowsingUtils.isWindowPrivate(win2) === false) {
      win2.BrowserOpenTab(); // open tab
      return;
    }
  }

  // all windows are private
  win.OpenBrowserWindow(); // open window
}


function selectTab(tab) {
  var win = tab.ownerDocument.defaultView;
  UIUtils.getContentContainer(win).selectedTab = tab;
  win.focus();
}


function findParentPanel(elem) {
  var e = elem;
  while (e.localName !== "panel") {
    e = e.parentNode;
  }
  return e;
}


function getTabs() {
  var arr = [];
  for (var winId of getSortedWindows()) {
    var win = Services.wm.getOuterWindowWithId(winId);
    for (var tab of UIUtils.getTabList(win)) {
      arr.push(tab);
    }
  }
  return arr;
}


function getSortedWindows() {
  var arr = [];

  var enumWin = Services.wm.getEnumerator("navigator:browser");
  while (enumWin.hasMoreElements()) {
    arr.push(util.getOuterId(enumWin.getNext()));
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
    var winId = util.getOuterId(enumWin.getNext()).toString();
    Services.obs.notifyObservers(null, "${BASE_DOM_ID}-id-changed", winId);
  }
}


function deleteCurrentPopup(win) {
  win.document.getElementById("${CHROME_NAME}-arrow-panel").hidePopup();

  var profileId = Profile.getIdentity(UIUtils.getSelectedTab(win).linkedBrowser);

  var enumWin = Services.wm.getEnumerator("navigator:browser");
  while (enumWin.hasMoreElements()) {
    for (var tab of UIUtils.getTabList(enumWin.getNext())) {
      if (Profile.getIdentity(tab.linkedBrowser) === profileId) {
        var tb = UIUtils.getContentContainer(tab.ownerDocument.defaultView);
        tb.removeTab(tab, {animate: true});
      }
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
  console.assert(doc.getElementById("${CHROME_NAME}-arrow-panel") === null, "dupe panel");

  var fragment = doc.createDocumentFragment();
  var panel = fragment.appendChild(doc.createElement("panel"));
  panel.setAttribute("id", "${CHROME_NAME}-arrow-panel");
  panel.setAttribute("type", "arrow");

  var container = panel.appendChild(doc.createElement("hbox"));
  var col1 = container.appendChild(doc.createElement("vbox"));
  var img = col1.appendChild(doc.createElement("image"));
  switch (icon) {
    case "warning":
      img.setAttribute("src", "chrome://global/skin/icons/warning-large.png"); // 48px
      break;
    case "error":
      // BUG OS X 404 "chrome://global/skin/icons/error-48.png"
      img.setAttribute("src", "chrome://global/skin/icons/error-64.png");
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

  panel.addEventListener("popuphidden", function(evt) {
    var myPanel = evt.target;
    console.assert(myPanel.localName === "panel", "myPanel should be a panel element", myPanel);
    myPanel.parentNode.removeChild(myPanel);
  }, false);

  doc.getElementById("mainPopupSet").appendChild(fragment);
  panel.openPopup(button, "bottomcenter topright");
  return col2;
}


function removeData() {
  // TODO localStorage
  // cookies
  var list = Profile.getProfileList();
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


  var list = ProfileAlias.sort(Profile.getProfileList());
  var profileId = Profile.getIdentity(UIUtils.getSelectedTab(doc.defaultView).linkedBrowser);
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
  ph.addEventListener("click", handleMiddleClick);
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
  item.setAttribute("profile-id", "");
  if (PrivateBrowsingUtils.permanentPrivateBrowsing) {
    item.setAttribute("disabled", "true");
  }
}


function appendList(fragment, list, profileId) {
  appendSeparator(fragment);
  appendMenuItem(fragment, Profile.DefaultIdentity, profileId);
  var item = appendButton(fragment, ProfileAlias.format(Profile.PrivateIdentity));
  item.setAttribute("oncommand", formatCallCommand("cmd_select_tab"));
  item.setAttribute("profile-id", Profile.PrivateIdentity);

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

  var cmd = formatCallCommand("cmd_select_tab");

  if (id !== profileId) {
    var item = appendButton(fragment, name);
    item.setAttribute("oncommand", cmd);
    item.setAttribute("profile-id", id);
    return;
  }

  var items = fragment.appendChild(fragment.ownerDocument.createElement("toolbaritem"));

  var item = appendButton(items, name);
  item.setAttribute("type", "radio");
  item.setAttribute("checked", "true");
  item.setAttribute("flex", "1");
  item.setAttribute("oncommand", cmd);
  item.setAttribute("profile-id", id);

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
    item.setAttribute("oncommand", formatCallCommand("cmd_set_profile_tab", list[idx]));
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
