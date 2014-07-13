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
  appendProfileMenu(menu, "placesContext_open:newwindow",
                          "placesContext_openSeparator",
                          "context.places2.label",
                          "context.places2.accesskey");
}


function contentMenu(menu) {
  appendProfileMenu(menu, "context-openlinkintab",
                          "context-sep-open",
                          "context.link2.label",
                          "context.link2.accesskey");
}


function appendProfileMenu(menu, testId, posId, label, accesskey) {
  var doc = menu.ownerDocument;
  var item = doc.getElementById(testId);
  if (item === null || item.hidden) {
    return;
  }

  var position = doc.getElementById(posId);

  var sep = menu.insertBefore(doc.createElement("menuseparator"), position);
  sep.setAttribute("id", "${BASE_DOM_ID}-link-sep");

  var cmd = doc.createElement("menu");
  cmd.setAttribute("id", "${BASE_DOM_ID}-link-cmd");
  cmd.setAttribute("label", util.getText(label));
  cmd.setAttribute("accesskey", util.getText(accesskey));

  if (PrivateBrowsingUtils.isWindowPrivate(doc.defaultView)) {
    cmd.setAttribute("disabled", "true");
  }

  var fragment = doc.createDocumentFragment();
  Components.utils.import("${PATH_MODULE}/commands.js", null).
    getProfileListMenu().
    renderLinkMenu(fragment);
  cmd.appendChild(doc.createElement("menupopup")).appendChild(fragment);

  menu.insertBefore(cmd, position);
  menu.addEventListener("popuphidden", onPopupHidden, false);
}
