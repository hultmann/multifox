/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";


function welcomePopup(doc) {
  var panel = doc.getElementById("${BASE_ID}-popup");
  if (panel) {
    //bug
    panel.hidePopup();
    return null; // panel is now invalid
  }

  panel = doc.getElementById("mainPopupSet").appendChild(doc.createElement("panel"));
  panel.setAttribute("id", "${BASE_ID}-popup");
  panel.setAttribute("type", "arrow");
  panel.addEventListener("popuphidden", function(evt) {
    panel.parentNode.removeChild(panel);
    initIconNormal(doc);
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
}
