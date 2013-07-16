/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


function getIconNode(doc) {
  if (!doc) {
    util2.throwStack.go("getIconNode "+doc);
  }
  return doc.getElementById("multifox-icon");
}


function removeUI(doc) {
  console.log("removeUI");
  var icon = getIconNode(doc);
  if (icon) {
    icon.parentNode.removeChild(icon);
  }
}


function getTabStatus(browser) {
  return browser.hasAttribute("multifox-tab-status")
          ? browser.getAttribute("multifox-tab-status") : "";
}


function tabSelected(evt) {
  var tab = evt.originalTarget;
  var doc = tab.ownerDocument;
  var currentStat = getIconNode(doc).getAttribute("tab-status");
  var newStat = getTabStatus(tab.linkedBrowser);
  if (currentStat !== newStat) {
    updateStatus(doc);
  }
}


function updateStatus(doc) {
  var browser = doc.defaultView.getBrowser().selectedBrowser;
  var tabStat = getTabStatus(browser);
  getIconNode(doc).setAttribute("tab-status", tabStat);

  var stat = doc.getElementById("multifox-icon-stat-icon");
  while (stat.firstChild) {
    stat.removeChild(stat.firstChild);
  }

  var show = tabStat.length > 0;
  if (show) {
    var img = stat.appendChild(doc.createElement("image"));
    img.setAttribute("src", "chrome://global/skin/icons/warning-16.png"); // ubuntu: 22x22
    img.setAttribute("width", "16");
    img.setAttribute("height", "16");
    img.style.margin = "0 -4px 0 7px";
    stat.removeAttribute("hidden");
  } else {
    stat.setAttribute("hidden", "true");
  }
}


function updateUI(win) {
  var profileId = Profile.getIdentity(win);
  console.log("updateUI " + profileId);

  var doc = win.document;
  if (profileId <= Profile.DefaultIdentity) {
    removeUI(doc);
    return;
  }

  var icon = getIconNode(doc);
  if (icon) {
    var label = icon.querySelector("label");
    console.log("updateUI=" + profileId + " " + label + " current=" + Profile.getIdentity(win));
    // label=null ==> urlbar has just been placed on the toolbar
    if (label) {
      label.setAttribute("value", Profile.toString(profileId));
      return;
    }
    removeUI(doc);
  }


  // <hbox align="center" id="multifox-icon">
  //   <box>
  //     <hbox align="center">
  //       <hbox id="multifox-icon-stat-icon">
  //         <image src="warning.png"/>
  //       </hbox>
  //       <label value="100"/>


  var ref = doc.getElementById("urlbar-icons");
  if (ref === null) {
    console.log("updateUI ref=null");
    return; // ref=null after toolbar customization. However, it is valid on new windows!
  }

  var iconContainer = ref.appendChild(doc.createElement("hbox"));
  iconContainer.setAttribute("hidden", "true");
  iconContainer.setAttribute("id", "multifox-icon");


  if (profileId !== Profile.UndefinedIdentity) {
    win.setTimeout(initIconCore, 250, iconContainer, profileId);
  }
}


function initIconCore(iconContainer, profileId) {
  var doc = iconContainer.ownerDocument;
  if (iconContainer !== getIconNode(doc)) {
    // getIconNode(doc)=null ===> urlbar hidden?
    console.log("initIconCore != " + profileId + iconContainer + getIconNode(doc));
    removeUI(doc);
    return;
  }


  iconContainer.setAttribute("align", "center");
  iconContainer.style.margin = "0px 2px 0px 1px";

  var icon = iconContainer.appendChild(doc.createElement("box"));
  icon.setAttribute("tooltiptext", "${EXT_NAME}");


  var styleIcon = icon.style;
  styleIcon.padding = "0px";
  styleIcon.margin = "0px";
  styleIcon.background = "transparent repeat-x";
  styleIcon.borderRadius = "2px";
  styleIcon.minHeight = "16px";


  var os = Services.appinfo.OS;
  switch (os) {
    case "Darwin":
      styleIcon.backgroundImage = "url(${PATH_CONTENT}/icon-osx.png)";
      styleIcon.backgroundColor = "#416ea5";
      break;
    case "WINNT":
      styleIcon.backgroundImage = "url(${PATH_CONTENT}/icon.png)";
      styleIcon.backgroundColor = "#4ab0f6";
      break;
    default:
      styleIcon.backgroundImage = "url(${PATH_CONTENT}/icon-linux.png)";
      styleIcon.backgroundColor = "#6184c3";
      break;
  }



  var labelContainer = icon.appendChild(doc.createElement("hbox"));
  labelContainer.setAttribute("align", "center");


  var stat = labelContainer.appendChild(doc.createElement("hbox"));
  stat.setAttribute("hidden", "true");
  stat.setAttribute("id", "multifox-icon-stat-icon");


  var lb = labelContainer.appendChild(doc.createElement("label"));
  lb.setAttribute("value", Profile.toString(profileId));
  var styleLabel = lb.style;

  styleLabel.color = "white";
  styleLabel.fontWeight = "bold";
  styleLabel.fontStyle = "normal";
  styleLabel.textRendering = "optimizelegibility";
  styleLabel.textShadow = "1px 1px 1px black";
  styleLabel.padding = "0px 9px";
  styleLabel.margin = "-1px 0px";

  initIconNormal(icon);
  //iconContainer.removeAttribute("hidden");
}


function initIconNormal(icon) {
  icon.ownerDocument.defaultView.setTimeout(function() {
    // workaround
    // otherwise, mousedown on icon will close and open popup, even with stopPropagation
    icon.addEventListener("mousedown", openMultifoxPopup, false);
  }, 0);
  icon.addEventListener("mouseover", onIconHover, false);
  icon.addEventListener("mouseout", onIconHover, false);
  icon.style.backgroundPosition = "0pt 0pt";
  icon.querySelector("label").style.textShadow = "1px 1px 1px black";
}


function initIconPressed(icon) { // openpopup
  icon.removeEventListener("mousedown", openMultifoxPopup, false);
  icon.removeEventListener("mouseover", onIconHover, false);
  icon.removeEventListener("mouseout", onIconHover, false);
  icon.style.backgroundPosition = "0pt -64px";
  icon.querySelector("label").style.textShadow = "1px 1px 1px black, 0 1px 5px white, 3px 0 5px white, 0 -1px 5px white, -3px 0 5px white";
}


function onIconHover(evt) {
  var doc = evt.target.ownerDocument;
  var icon = getIconNode(doc).firstChild;

  switch (evt.type) {
    case "mouseover":
      icon.style.backgroundPosition = "0pt -32px";
      icon.querySelector("label").style.textShadow = "1px 1px 1px black, 0 1px 5px white, 3px 0 5px white, 0 -1px 5px white, -3px 0 5px white";
      break;
    case "mouseout":
      icon.style.backgroundPosition = "0pt 0pt";
      icon.querySelector("label").style.textShadow = "1px 1px 1px black";
      break;
  }
}


function openMultifoxPopup(evt) {
  if ((evt.button !== 0) || (evt.detail !== 1)) {
    // left click only
    return;
  }

  Components.utils.import("${PATH_MODULE}/popup.js");
  var icon = evt.currentTarget; //or this

  var panel = createMultifoxPopup(icon, Profile);
  initIconPressed(icon);

  panel.addEventListener("popuphidden", function(evt) {
    initIconNormal(icon);
  }, false);

  panel.openPopup(icon, "bottomcenter topright");

  // remove error icon
  var doc = icon.ownerDocument;
  var browser = doc.defaultView.getBrowser().selectedBrowser;
  browser.removeAttribute("multifox-tab-status");
  updateStatus(doc);
}
