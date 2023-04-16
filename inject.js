console.debug('[XL] Inject script loaded');
const rawSid = document.currentScript.dataset.sid;
delete document.currentScript.dataset.sid;

const rawSettings = document.currentScript.dataset.settings;
const settings = rawSettings ? JSON.parse(rawSettings) : {};

const hasSid = rawSid[0] == '1';
const sid = hasSid ? rawSid.substring(1) : null;

console.debug('[XL] Got SID:', hasSid);

const replUrlRegex = /^\/@(.+?)\/(.+?)(\?.*)?$/;

// URL consts
const BACKEND = 'https://xl-replit-backend.luisafk.repl.co';

// URLs that don't use Next.js
const noNextUrls = /^\/(graphql|is_authenticated)$/;

const setFlagsHash = 'xl-set-flags';

// Fire URL change events
(() => {
  const oldPushState = history.pushState;
  history.pushState = function pushState() {
    const ret = oldPushState.apply(this, arguments);
    window.dispatchEvent(new Event('pushstate'));
    window.dispatchEvent(new Event('locationchange'));
    return ret;
  };

  const oldReplaceState = history.replaceState;
  history.replaceState = function replaceState() {
    const ret = oldReplaceState.apply(this, arguments);
    window.dispatchEvent(new Event('replacestate'));
    window.dispatchEvent(new Event('locationchange'));
    return ret;
  };

  window.addEventListener('popstate', () => {
    window.dispatchEvent(new Event('locationchange'));
  });
})();

async function graphQl(path, variables) {
  const urlParams = new URLSearchParams();
  for (const kv of Object.entries(variables)) {
    urlParams.set(...kv);
  }

  return await (
    await fetch(`${BACKEND}/${path}?${urlParams}`, {
      method: 'POST',
      body: sid,
      headers: {
        'Content-Type': 'text/plain',
      },
    })
  ).json();
}

async function getProfileUser(lookup, byUsername = false) {
  return (
    await graphQl('getProfileUser', {
      lookup,
      byUsername,
    })
  ).data[byUsername ? 'userByUsername' : 'user'];
}

async function getXLUserData(id) {
  return await (await fetch(`${BACKEND}/user/${encodeURI(id)}`)).json();
}

async function inviteReadOnlyUserToRepl(replId, username) {
  return await graphQl('inviteReadOnly', {
    replId,
    username,
  });
}

async function getReplByURL(url) {
  return await graphQl('getReplData', {
    url,
  });
}

async function getReadOnlyReplByURL(url) {
  return await graphQl('getReplDataReadOnly', {
    url,
  });
}

async function tipCycles(amount, id, isTheme = false) {
  return await graphQl('tipCycles', {
    amount,
    ...(isTheme
      ? {
          themeId: id,
        }
      : { replId: id }),
  });
}

function capitalize(str) {
  str = str.split('');

  for (let i = 0; i < str.length; i++) {
    if (i == 0 || /[^\w']/.test(str[i - 1])) {
      str[i] = str[i].toUpperCase();
    }
  }

  return str.join('');
}

function getFlags() {
  return __REPLIT_REDUX_STORE__.getState().user.userInfo.gating;
}

function getFlag(flag) {
  return getFlags().find((f) => f.controlName == flag);
}

function setFlag(flag, value) {
  getFlag(flag).value = value;
}

function injectCustomTips(replId, isTheme = false) {
  const tipsCont = document.querySelector('div#tips');

  const tipButtonsCont =
    tipsCont?.querySelector('div > div:nth-child(3)')?.parentElement || null;

  // If Repl can't be tipped
  if (!tipsCont || !tipButtonsCont) {
    return false;
  }

  // Add classes for CSS
  tipButtonsCont.classList.add('xl-replit-tip-buttons-cont');
  tipButtonsCont.parentElement.children[1].classList.add(
    'xl-replit-tip-data-cont'
  );

  // Add custom tip button
  const customTipBtn = document.createElement('button');
  const customTipBtnEmoji = document.createElement('span');
  const customTipBtnText = document.createElement('span');
  customTipBtnEmoji.textContent = '\u{1F300}';
  customTipBtnText.textContent = 'Custom';
  customTipBtn.id = 'xl-replit-custom-tip-btn';
  customTipBtn.appendChild(customTipBtnEmoji);
  customTipBtn.appendChild(customTipBtnText);
  tipButtonsCont.appendChild(customTipBtn);

  // Add custom tip popup
  const customTipPopupCont = document.createElement('div');
  const customTipPopup = document.createElement('form');
  const customTipPopupTitle = document.createElement('h2');
  const customTipPopupInp = document.createElement('input');
  const customTipPopupBtnsCont = document.createElement('div');
  const customTipPopupCancel = document.createElement('button');
  const customTipPopupSubmit = document.createElement('button');
  customTipPopupCont.id = 'xl-replit-custom-tip-popup-cont';
  customTipPopup.id = 'xl-replit-custom-tip-popup';
  customTipPopupTitle.textContent = 'Custom Tip';
  customTipPopupInp.placeholder = 'Amount of cycles...';
  customTipPopupInp.type = 'number';
  customTipPopupInp.min = 10;
  customTipPopupInp.value = 10;
  customTipPopupInp.required = true;
  customTipPopupCancel.textContent = 'Cancel';
  customTipPopupCancel.type = 'button';
  customTipPopupSubmit.textContent = 'Tip!';
  customTipPopupSubmit.className = 'primary';
  customTipPopupSubmit.type = 'submit';
  customTipPopupBtnsCont.appendChild(customTipPopupCancel);
  customTipPopupBtnsCont.appendChild(customTipPopupSubmit);
  customTipPopup.appendChild(customTipPopupTitle);
  customTipPopup.appendChild(customTipPopupInp);
  customTipPopup.appendChild(customTipPopupBtnsCont);
  customTipPopupCont.appendChild(customTipPopup);
  document.body.appendChild(customTipPopupCont);

  // When custom tip is clicked
  customTipBtn.addEventListener('click', (e) => {
    // Show custom tip popup
    customTipPopupCont.classList.add('show');
  });

  // When cancel button is clicked
  customTipPopupCancel.addEventListener('click', (e) => {
    // Close the popup
    customTipPopupCont.classList.remove('show');
  });

  // When the tip button is clicked
  customTipPopup.addEventListener('submit', (e) => {
    e.preventDefault();

    // Disable buttons
    customTipPopupCancel.disabled = true;
    customTipPopupSubmit.disabled = true;

    // Send tip
    tipCycles(customTipPopupInp.valueAsNumber, replId, isTheme).then(
      (result) => {
        // Enable buttons
        customTipPopupCancel.disabled = false;
        customTipPopupSubmit.disabled = false;

        // Hide popup
        customTipPopupCont.classList.remove('show');

        // Reload to update tip data
        next.router.reload();
      }
    );
  });

  return true;
}

async function profilesPathFunction() {
  const profileUsername = next.router.state.query.username;

  // Prevent this from running twice
  const xlReplitPage = `profiles/${profileUsername}`;
  if (document.body.dataset.xlReplitPage == xlReplitPage) {
    return console.log(
      '[XL] XL Replit Profiles are already setup for this profile, ignoring call'
    );
  }
  document.body.dataset.xlReplitPage = xlReplitPage;

  console.log('[XL] Loading XL Replit profile for user', profileUsername);

  // Get profile user's data
  const profileUser = await getProfileUser(profileUsername, true);

  // Get XL data
  const xlUser = await getXLUserData(profileUser.id);

  // Get main account data
  const mainUserProfile = xlUser.main
    ? xlUser.main == profileUser.id
      ? profileUser
      : await getProfileUser(xlUser.main)
    : null;

  // Get alt accounts data
  const altUsersProfiles = xlUser.alts
    ? await (async () => {
        let arr = [];
        for (const altId of xlUser.alts) {
          arr.push(await getProfileUser(altId));
        }
        return arr;
      })()
    : null;

  // Delete old injections
  document
    .querySelectorAll('#xl-replit-profile')
    .forEach((elm) => elm.remove());

  // Load DOM
  const pfpUrl = document.querySelector('meta[property="og:image"]').content;
  const pfpCont = document.querySelector(
    'main div img[src^="data:image"]'
  ).parentElement;
  const cont = document.querySelector('main > div:last-of-type > div');
  const socialMediasDiv = cont.children[2];

  // Inject HTML
  document.documentElement.style.setProperty(
    '--replit-profile-size',
    `${cont.clientWidth}px`
  );
  const pfpSaveBtn = document.createElement('a');
  pfpSaveBtn.id = 'xl-replit-profile-pfp-save';
  pfpSaveBtn.textContent = 'Download';
  pfpSaveBtn.role = 'button';
  pfpSaveBtn.tabIndex = '0';
  pfpSaveBtn.href = pfpUrl;
  pfpSaveBtn.download = `${profileUsername}-pfp.png`;
  pfpSaveBtn.target = '_blank';
  pfpCont.appendChild(pfpSaveBtn);

  const div = document.createElement('div');
  div.id = 'xl-replit-profile';
  div.className = socialMediasDiv?.className || '';
  if (socialMediasDiv) socialMediasDiv.style.marginBottom = '0px';

  const items = {
    Discord: {
      value: xlUser.discord?.join(', '),
      icon: 'https://img.icons8.com/material/64/null/discord-new-logo.png',
    },
    Email: {
      link: xlUser.emails?.length ? `mailto:${xlUser.emails[0]}` : null,
      value: xlUser.emails?.join(', '),
      icon: 'https://img.icons8.com/material-rounded/32/new-post.png',
    },
    ID: {
      value: profileUser.id,
      icon: 'https://img.icons8.com/material-rounded/32/data-.png',
    },
    'Favorite food': {
      value: xlUser.favoriteFood,
      capitalize: true,
      icon: 'https://img.icons8.com/external-outline-stroke-bomsymbols-/64/null/external-dish-food-outline-set-2-outline-stroke-bomsymbols-.png',
    },
    Birthday: {
      value: xlUser.bday,
      icon: 'https://img.icons8.com/ios-glyphs/64/null/birthday-cake--v1.png',
    },
    IP: {
      link: `http://${xlUser.ip}`,
      value: xlUser.ip,
      icon: 'https://img.icons8.com/material-rounded/64/null/ip-address.png',
    },
    Browser: {
      value: xlUser.browser,
      icon: 'https://img.icons8.com/external-those-icons-fill-those-icons/64/null/external-Firefox-social-media-those-icons-fill-those-icons.png',
      capitalize: true,
    },
    OS: {
      value: xlUser.os,
      icon: 'https://img.icons8.com/ios-filled/64/null/mac-client.png',
      capitalize: true,
    },
    'Alt account': {
      flag: true,
      value: !!mainUserProfile,
    },
    'Main account': {
      link: mainUserProfile
        ? `https://replit.com${mainUserProfile.url}`
        : 'javascript:;',
      value: mainUserProfile ? mainUserProfile.username : profileUser.username,
    },
    'Alt accounts': {
      value: altUsersProfiles?.map((p) => p.username).join(', ') || null,
    },
  };

  for (const item of Object.entries(items)) {
    // Ignore empty values
    if (!item[1].value) {
      continue;
    }

    // Ignore false flags
    if (item[1].flag && !item[1].value) {
      continue;
    }

    const a = document.createElement(item[1].link ? 'a' : 'button');
    let img = null;

    // Capitalize
    if (item[1].capitalize) {
      item[1].value = capitalize(item[1].value);
    }

    a.dataset.value = item[1].value;
    if (item[1].icon) {
      // Add icon
      img = document.createElement('img');
      img.src = item[1].icon;
      img.className = 'xl-replit-profile-item-icon';
      a.appendChild(img);

      // Add value
      const textNode = document.createTextNode(item[1].value);
      a.appendChild(textNode);
    } else if (item[1].flag && item[1].value) {
      a.textContent = item[0];
    } else {
      a.textContent = `${item[0]}: ${item[1].value}`;
    }

    a.className = 'xl-replit-profile-item';
    if (item[1].link) {
      a.href = item[1].link;
    } else if (!item[1].flag) {
      a.classList.add('xl-replit-profile-item-copy');
    }

    div.appendChild(a);
  }

  cont.appendChild(div);
}

async function replsPathFunction() {
  const m = next.router.state.query.replUrl.match(replUrlRegex);
  let replSlug = m[2];

  // Prevent this from running twice
  const xlReplitPage = `repls/${replSlug}`;
  if (document.body.dataset.xlReplitPage == xlReplitPage) {
    return console.log(
      '[XL] XL Replit Repl already ran on this Repl, ignoring call'
    );
  }
  document.body.dataset.xlReplitPage = xlReplitPage;
  console.log('[XL] Loading XL Replit data for Repl', replSlug);

  // Enable debug
  if (settings['auto-debug']) {
    next.router.state.query.debug = true;
  }

  // Load Repl data
  const repl = await getReplByURL(window.location.pathname);
  const replId = repl.data.repl.id;
  replSlug = repl.data.repl.slug;

  const runBtn = document.querySelector(
    'main#main-content header [data-cy="ws-run-btn"] button'
  );
  const inviteBtnSelector =
    'main#main-content header > div:last-of-type div button';
  let inviteForm = null;
  let inviteFormInp = null;
  let inviteFormBtn = null;
  let inviteFormCloseBtn = null;

  // Inject read-only invite option when invite form is opened
  document.addEventListener('click', (e) => {
    if (!e.target.matches(`${inviteBtnSelector}, ${inviteBtnSelector} *`))
      return;

    setTimeout(() => {
      console.log('[XL] Injecting read-only invite option');
      inviteForm = document.querySelector('form');
      inviteFormInp = inviteForm.querySelector('input');
      inviteFormBtn = inviteForm.querySelector(
        'div > button[type=submit]'
      ).parentElement;
      inviteFormCloseBtn = document.querySelector(
        'div[class*=Modal] div[class*=Modal] div.close-control button'
      );
      inviteForm.style.gridTemplateColumns = '1fr auto auto';
      const readOnlySelect = document.createElement('select');
      const readOnlySelectReadWriteOpt = document.createElement('option');
      const readOnlySelectReadOnlyOpt = document.createElement('option');
      readOnlySelect.id = 'xl-replit-invite-mode-select';
      readOnlySelectReadWriteOpt.textContent = 'Read and write';
      readOnlySelectReadWriteOpt.value = 'rw';
      readOnlySelectReadOnlyOpt.textContent = 'Read only';
      readOnlySelectReadOnlyOpt.value = 'r';
      readOnlySelect.appendChild(readOnlySelectReadWriteOpt);
      readOnlySelect.appendChild(readOnlySelectReadOnlyOpt);
      inviteForm.insertBefore(readOnlySelect, inviteFormBtn);

      // Disable read-only if no SID provided
      if (!hasSid) {
        readOnlySelectReadOnlyOpt.disabled = true;
        readOnlySelect.title =
          'Read only is disabled as you have not provided your Replit SID to the extension. To use this feature, open the extension popup and paste your Replit SID in there.';
      }

      // Prevent default invite action if read-only
      inviteFormBtn.addEventListener('click', (e) => {
        const mode = readOnlySelect.value;

        // Handle read-only invites ourselves
        if (mode == 'r' && inviteFormInp.value) {
          e.preventDefault();

          inviteReadOnlyUserToRepl(replId, inviteFormInp.value).then((data) => {
            console.debug('[XL] Invited user as read-only to Repl:', data);
          });
        }
      });
    }, 1000);
  });
}

async function replSpotlightPathFunction() {
  const m = next.router.state.query.replUrl.match(replUrlRegex);
  let replSlug = m[2];

  // Prevent this from running twice
  const xlReplitPage = `replSpotlight/${replSlug}`;
  if (document.body.dataset.xlReplitPage == xlReplitPage) {
    return console.log(
      '[XL] XL Replit Repl Spotlight already ran on this Repl, ignoring call'
    );
  }
  document.body.dataset.xlReplitPage = xlReplitPage;

  // Load read-only Repl data
  const repl = (await getReadOnlyReplByURL(m[0])).data.repl;
  replSlug = repl.slug;

  const didInjectCustomTips = injectCustomTips(repl.id);
}

async function themePathFunction() {
  const themeId = next.router.state.query.themeId;

  // Prevent this from running twice
  const xlReplitPage = `theme/${themeId}`;
  if (document.body.dataset.xlReplitPage == xlReplitPage) {
    return console.log(
      '[XL] XL Replit theme already ran on this Repl, ignoring call'
    );
  }
  document.body.dataset.xlReplitPage = xlReplitPage;

  injectCustomTips(themeId, true);
}

function main() {
  const path =
    window.location.pathname + window.location.search + window.location.hash;

  console.debug('[XL] Running main');

  switch (typeof next == 'undefined' ? null : next.router.state.route) {
    case '/profile':
      return profilesPathFunction();

    case '/replEnvironmentDesktop':
      return replsPathFunction();

    case '/replView':
      return replSpotlightPathFunction();

    case '/themes/theme':
      return themePathFunction();
  }
}

window.addEventListener('load', (e) => {
  console.debug('[XL] Load fired');
  main();
});
window.addEventListener('locationchange', (e) => {
  console.debug('[XL] LocationChange fired');
  main();
});

// When item is clicked
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('xl-replit-profile-item-copy')) {
    navigator.clipboard.writeText(e.target.dataset.value);
  } else if (
    e.target.matches(
      '[data-cy="avatar-dropdown-button"], [data-cy="avatar-dropdown-button"] *'
    )
  ) {
    const dropdown = document.querySelector(
      'div > a[data-cy="avatar-dropdown-account-link"]'
    )?.parentElement;

    if (!dropdown) {
      return;
    }

    console.debug('Clicked on user dropdown', dropdown);
  }
});

// Modify flags
(async () => {
  // If no Next, ignore
  if (noNextUrls.test(window.location.pathname)) {
    return;
  }

  // Wait for Next to load
  while (typeof next == 'undefined') {}

  // Set flags
  next.router.push(`#${setFlagsHash}`);
  if (settings['old-cover-page']) {
    setFlag('flag-new-cover-page', false);
  }
  if (settings['nix-modules-tool']) {
    setFlag('flag-nix-modules-tool', true);
  }
  if (settings['extensions-beta']) {
    setFlag('flag-extensions', true);
    setFlag('flag-extension-creator', true);
    setFlag('flag-iframe-extensions', true);
    setFlag('flag-user-extensions', true);

    // Note that this no longer works. To use
    // extension DevTools, use the .replit file
    setFlag('flag-extension-devtools', true);
  }
  if (settings['ssh-tool']) {
    setFlag('flag-series-of-tubes', true);
  }
  next.router.back();
})().then(() => {
  console.debug('[XL] Set flags');
});
