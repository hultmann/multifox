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
 * Portions created by the Initial Developer are Copyright (C) 2011
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

Components.utils.import("${PATH_MODULE}/new-window.js");


function welcomePopup(doc) {
  var panel = doc.getElementById("multifox-popup");
  if (panel) {
    //bug
    panel.hidePopup();
    return panel;
  }

  panel = doc.getElementById("mainPopupSet").appendChild(doc.createElement("panel"));
  panel.setAttribute("id", "multifox-popup");
  panel.setAttribute("type", "arrow");
  panel.addEventListener("popuphidden", function(evt) {
    panel.parentNode.removeChild(panel);
  }, false);

  var container = panel.appendChild(doc.createElement("vbox"));
  container.style.width = "50ch";
  container.style.margin = ".0ch";
  appendContent(container, panel);
  return panel;
}


function appendContent(container, panel) {
  var doc = container.ownerDocument;
  var desc;
  var header;

  // logo
  var box2 = container.appendChild(doc.createElement("hbox"));
  box2.setAttribute("pack", "center");
  var img = box2.appendChild(doc.createElement("image"));
  img.setAttribute("src", "${PATH_CONTENT}/logo-popup.png");
  img.setAttribute("width", "175");
  img.setAttribute("height", "97");

  desc = container.appendChild(doc.createElement("description"));
  desc.appendChild(doc.createTextNode(util.getTextFrom("welcome.properties", "welcome.p1", "${EXT_NAME}")));

  // Getting Started
  header = container.appendChild(doc.createElement("label"));
  header.value = util.getTextFrom("welcome.properties", "welcome.p2.h");
  header.className = "header";
  header.style.marginTop = "1ch";

  desc = container.appendChild(doc.createElement("description"));
  desc.style.marginTop = "1ch";
  desc.appendChild(doc.createTextNode(util.getTextFrom("welcome.properties", "welcome.p2", "${EXT_NAME}")));

  desc = container.appendChild(doc.createElement("description"))
  desc.style.marginTop = "1ch";
  desc.appendChild(doc.createTextNode(util.getTextFrom("welcome.properties", "welcome.p3", util.getText("icon.user.new.label"))));

  // Multifox 1
  header = container.appendChild(doc.createElement("label"));
  header.value = util.getTextFrom("welcome.properties", "welcome.p4.h");
  header.className = "header";
  header.style.marginTop = "1ch";

  desc = container.appendChild(doc.createElement("description"))
  desc.style.marginTop = "1ch";
  desc.appendChild(doc.createTextNode(util.getTextFrom("welcome.properties", "welcome.p4.p1", "${EXT_NAME}")));

  desc = container.appendChild(doc.createElement("description"))
  desc.style.marginTop = "1ch";
  desc.appendChild(doc.createTextNode(util.getTextFrom("welcome.properties", "welcome.p4.p2")));
}
