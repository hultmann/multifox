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

"use strict";

const EXPORTED_SYMBOLS = ["menuShowing"];

Components.utils.import("${PATH_MODULE}/new-window.js");

function menuShowing(evt) {
  var menu = evt.target;
  switch (menu.id || menu.getAttribute("anonid") || menu.getAttribute("multifox-id")) {
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
    case "app-menu":
      appMenu(menu);
      break;
  }
}

function onPopupHidden(evt) {
  var menu = evt.currentTarget; // <popup> <menupopup>
  if (menu !== evt.target) {
    return;
  }
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


function appMenu(menu) {
  var doc = menu.ownerDocument;
  var position = doc.getElementById("appmenu_openFile");

  var cmd = doc.createElement("menuitem");
  cmd.setAttribute("id", "${BASE_DOM_ID}-link-cmd");
  cmd.setAttribute("label", util.getText("appmenu.new.label"));
  cmd.setAttribute("accesskey", util.getText("appmenu.new.accesskey"));
  cmd.addEventListener("command", function(evt) {newIdentityCommand(evt, "appMenu");}, false);
  cmd.setAttribute("key", "key_${BASE_DOM_ID}-new-identity");
  menu.insertBefore(cmd, position);

  var sep = menu.insertBefore(doc.createElement("menuseparator"), position);
  sep.setAttribute("id", "${BASE_DOM_ID}-link-sep");

  menu.addEventListener("popuphidden", onPopupHidden, false);
}


function fileMenu(menu) {
  var doc = menu.ownerDocument;
  var position = doc.getElementById("menu_savePage");

  var cmd = doc.createElement("menuitem");
  cmd.setAttribute("id", "${BASE_DOM_ID}-link-cmd");
  cmd.setAttribute("label", util.getText("menu.file.label"));
  cmd.setAttribute("accesskey", util.getText("menu.file.accesskey"));
  cmd.addEventListener("command", function(evt) {newIdentityCommand(evt, "fileMenu");}, false);
  cmd.setAttribute("key", "key_${BASE_DOM_ID}-new-identity");
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
  menu.insertBefore(cmd, position);
  menu.addEventListener("popuphidden", onPopupHidden, false);
}


function contentMenu(menu) {
  var doc = menu.ownerDocument;
  var item = doc.getElementById("context-openlink");
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
  menu.insertBefore(cmd, position);

  menu.addEventListener("popuphidden", onPopupHidden, false);
}


function newIdentityCommand(evt, cmd) {
  console.log("newIdentityCommand " + cmd);
  newPendingWindow();

  var win = evt.currentTarget.ownerDocument.defaultView.top; // defaultView=history-panel.xul/browser.xul
  switch (cmd) {
    case "places":
      win.goDoPlacesCommand("placesCmd_open:window");
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
      win.gContextMenu.openLink();
      break;
    case "appMenu":
    case "fileMenu":
    default:
      var newWin = win.OpenBrowserWindow();
      break;
  }
}
