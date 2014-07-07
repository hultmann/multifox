/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


"use strict";

const EXPORTED_SYMBOLS = ["menuShowing"];

Components.utils.import("resource://gre/modules/PrivateBrowsingUtils.jsm");
Components.utils.import("${PATH_MODULE}/new-window.js");
Components.utils.import("${PATH_MODULE}/main.js");

function menuShowing(evt) {
  var menu = evt.target;
  switch (menu.id) {
    case "menu_FilePopup":
      fileMenu(menu);
      break;
    case "placesContext":
      placesMenu(menu);
      break;
    case "contentAreaContextMenu":
      contentMenu(menu);
      break;
    case "tabContextMenu":
      tabMenu(menu);
      break;
  }
}

function onPopupHidden(evt) {
  var menu = evt.currentTarget;
  if (menu !== evt.target) {
    return;
  }
  console.assert(menu.localName === "menupopup", "menu should be a menupopup element", menu);
  menu.removeEventListener("popuphidden", onPopupHidden, false);

  var doc = menu.ownerDocument;
  var removeMenuItem = function(id) {
    var el = doc.getElementById(id);
    if (el) {
      el.parentNode.removeChild(el);
    }
  }

  removeMenuItem("${BASE_DOM_ID}-link-cmd");
  removeMenuItem("${BASE_DOM_ID}-link-sep");
}


function fileMenu(menu) {
  var doc = menu.ownerDocument;
  var position = doc.getElementById("menu_savePage");

  var cmd = doc.createElement("menuitem");
  cmd.setAttribute("id", "${BASE_DOM_ID}-link-cmd");
  cmd.setAttribute("label", util.getText("menu.file.label"));
  cmd.setAttribute("accesskey", util.getText("menu.file.accesskey"));
  cmd.setAttribute("oncommand",
    "Components.utils.import('${PATH_MODULE}/commands.js',{})" +
    ".windowCommand(event,this,'cmd_new_profile')");

  cmd.setAttribute("key", "key_${BASE_DOM_ID}-new-identity");
  if (PrivateBrowsingUtils.permanentPrivateBrowsing) {
    cmd.setAttribute("disabled", "true");
    cmd.removeAttribute("command");
  }
  menu.insertBefore(cmd, position);

  var sep = menu.insertBefore(doc.createElement("menuseparator"), position);
  sep.setAttribute("id", "${BASE_DOM_ID}-link-sep");

  menu.addEventListener("popuphidden", onPopupHidden, false);
}


function placesMenu(menu) {
  var doc = menu.ownerDocument;

  var item = doc.getElementById("placesContext_open:newwindow");
  if (item === null || item.hidden) {
    return;
  }

  var position = doc.getElementById("placesContext_openSeparator");

  var sep = menu.insertBefore(doc.createElement("menuseparator"), position);
  sep.setAttribute("id", "${BASE_DOM_ID}-link-sep");

  var cmd = doc.createElement("menuitem");
  cmd.setAttribute("id", "${BASE_DOM_ID}-link-cmd");
  cmd.setAttribute("label", util.getText("context.places.label"));
  cmd.setAttribute("accesskey", util.getText("context.places.accesskey"));
  cmd.addEventListener("command", function(evt) {newIdentityCommand(evt, "places");}, false);
  if (PrivateBrowsingUtils.isWindowPrivate(doc.defaultView)) {
    cmd.setAttribute("disabled", "true");
  }
  menu.insertBefore(cmd, position);
  menu.addEventListener("popuphidden", onPopupHidden, false);
}


function contentMenu(menu) {
  var doc = menu.ownerDocument;
  var item = doc.getElementById("context-openlinkintab");
  if (item === null || item.hidden) {
    return;
  }

  var position = doc.getElementById("context-sep-open");

  var sep = menu.insertBefore(doc.createElement("menuseparator"), position);
  sep.setAttribute("id", "${BASE_DOM_ID}-link-sep");

  var cmd = doc.createElement("menuitem");
  cmd.setAttribute("id", "${BASE_DOM_ID}-link-cmd");
  cmd.setAttribute("label", util.getText("context.link.label"));
  cmd.setAttribute("accesskey", util.getText("context.link.accesskey"));
  cmd.addEventListener("command", function(evt) {evt, newIdentityCommand(evt, "link");}, false);
  if (PrivateBrowsingUtils.isWindowPrivate(doc.defaultView)) {
    cmd.setAttribute("disabled", "true");
  }

  menu.insertBefore(cmd, position);
  menu.addEventListener("popuphidden", onPopupHidden, false);
}


function tabMenu(menu) {
  var doc = menu.ownerDocument;
  var item = doc.getElementById("context_openTabInWindow");
  if (item === null || item.hidden) {
    item = doc.getElementById("tm-copyTabUrl"); // TMP?
  }

  var position = item === null ? null : item.nextSibling;

  var sep = menu.insertBefore(doc.createElement("menuseparator"), position);
  sep.setAttribute("id", "${BASE_DOM_ID}-link-sep");

  var cmd = doc.createElement("menuitem");
  cmd.setAttribute("id", "${BASE_DOM_ID}-link-cmd");
  cmd.setAttribute("label", util.getText("context.tab.label"));
  cmd.setAttribute("accesskey", util.getText("context.tab.accesskey"));
  cmd.addEventListener("command", function(evt) {evt, newIdentityCommand(evt, "tab");}, false);
  if (PrivateBrowsingUtils.isWindowPrivate(doc.defaultView)) {
    cmd.setAttribute("disabled", "true");
  }

  menu.insertBefore(cmd, position);
  menu.addEventListener("popuphidden", onPopupHidden, false);
}


function newIdentityCommand(evt, cmd) {
  var win = evt.currentTarget.ownerDocument.defaultView.top; // defaultView=history-panel.xul/browser.xul
  if (PrivateBrowsingUtils.isWindowPrivate(win)) {
    throw new Error("Command not supported in a private window.");
  }

  queueNewProfile(Profile.lowerAvailableId());

  switch (cmd) {
    case "places":
      win.goDoPlacesCommand("placesCmd_open:tab");
      break;
    case "tab":
      Components.utils.import("resource://gre/modules/Services.jsm");
      Services.ww.openWindow(
                    win,
                    "chrome://browser/content/browser.xul",
                    null,
                    "chrome,dialog=no,all",
                    win.getBrowser().mContextTab);
      break;
    case "link":
      win.gContextMenu.openLinkInTab();
      break;
    default:
      throw new Error("${EXT_NAME} - cmd unknown: " + cmd);
  }
}
