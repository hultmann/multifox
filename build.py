#!/usr/bin/python
# -*- coding: utf-8 -*-

# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

import build_tools
import sys

if len(sys.argv) > 1:
    changeset = sys.argv[1]
else:
    changeset = None

b = build_tools.BuildExtension("src", "build")

b.add_binary("icon.png")
b.add_binary("content/favicon.ico")
b.add_binary("content/icon.png")
b.add_binary("content/logo-about.png")


b.add_text("install.rdf")
b.add_text("chrome.manifest")
b.add_text("bootstrap.js")

b.add_text("content/content-injection.js")
b.add_text("content/about-multifox.html")
b.add_text("content/about-multifox.js")
b.add_text("content/button.css")

b.add_text("modules/new-window.js")
b.add_text("modules/main.js")
b.add_text("modules/menus.js")
b.add_text("modules/commands.js")


b.add_locale("en-US")
b.add_locale("pt-BR")
b.add_locale("sv-SE")
b.add_locale("zh-CN")
b.add_locale("zh-TW")
b.add_locale("sr")
b.add_locale("pl")
b.add_locale("ru")


b.add_text("locale/${locale}/extension.properties")
b.add_text("locale/${locale}/about-multifox.properties")

b.set_var("EXT_VERSION", "3.0.0b1")
verEx = build_tools.getVersionedString(changeset, b.get_var("EXT_VERSION"))

if changeset == None:
    b.set_var("SOURCE_URL", "https://github.com/hultmann/multifox/tree/master/src")
    b.set_var("EXT_VERSION", verEx)
else:
    b.set_var("SOURCE_URL", "https://github.com/hultmann/multifox/tree/" + changeset)


b.set_var("EXT_ID",          "multifox@hultmann")
b.set_var("EXT_NAME",        "Multifox")
b.set_var("EXT_SITE",        "http://br.mozdev.org/multifox/")
b.set_var("APP_MIN_VERSION", "30.0")
b.set_var("APP_MAX_VERSION", "33.*")
b.set_var("CHROME_NAME",     "multifox")
b.set_var("EXT_HOST",        "multifox-" + verEx)

b.set_var("PATH_CONTENT",    "chrome://"   + b.get_var("EXT_HOST") + "/content")
b.set_var("PATH_LOCALE",     "chrome://"   + b.get_var("EXT_HOST") + "/locale")
b.set_var("PATH_MODULE",     "resource://" + b.get_var("EXT_HOST"))

b.set_var("BASE_DOM_ID",            "multifox-dom")

b.set_var("PROFILE_SESSION",       "multifox-dom-identity-id-session")
b.set_var("PROFILE_BROWSER_ATTR",  "multifox-dom-identity-id-browser")
b.set_var("PROFILE_DISABLED_ATTR", "multifox-dom-identity-id-disabled")

b.set_var("PROFILE_DEPRECATED_DISABLED", "multifox-dom-identity-id-tmp")
b.set_var("PROFILE_DEPRECATED_SESSION",  "multifox-dom-identity-id")


b.set_var("XPCOM_ABOUT_CLASS",      "{347c41b6-1417-411c-b87a-422bcfc1899a}")
b.set_var("XPCOM_ABOUT_CONTRACT",   "@mozilla.org/network/protocol/about;1?what=multifox")

xpi = b.get_var("CHROME_NAME") + "-" + b.get_var("EXT_VERSION")
b.copy_files()

# AMO
b.set_var("UPDATE_DATA", "")
b.build_xpi(xpi + "-amo.xpi")

# website
b.set_var("UPDATE_DATA", (
"    <em:updateURL><![CDATA[http://br.mozdev.org/multifox/update.html"
       "?reqVersion=%REQ_VERSION%"
       "&extId=%ITEM_ID%"
       "&extVersion=%ITEM_VERSION%"
       "&extMaxappversion=%ITEM_MAXAPPVERSION%"
       "&extStatus=%ITEM_STATUS%"
       "&appId=%APP_ID%"
       "&appVersion=%APP_VERSION%"
       "&appOs=%APP_OS%"
       "&appAbi=%APP_ABI%"
       "&appLocale=%APP_LOCALE%]]>"
    "</em:updateURL>\n"
"    <em:updateKey>\n"
"      MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDeQmBgnA27cxcxXMlSA4QGaY41UKOXi8Ps\n"
"      J6IitDvvXsp9ZTzjdwDIdvJ7oB9dyycXlHZL9tKcatOwhXbUN0jt28hv8sYGxlj2oxIt5sOQ\n"
"      C0q/P2KHU5OAHMl/eRJIe8QINCBGI5CEr84ArnhJ7g+DYOFQfVtop3sNBYI78nEQ2wIDAQAB\n"
"    </em:updateKey>\n"))
b.build_xpi(xpi + ".xpi")
b.create_update_rdf(xpi + ".xpi")
