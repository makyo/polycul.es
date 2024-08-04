'use strict';

const PREVIOUSLY_VIEWED_ID = "previouslyViewed";
function getHash() {
    const pathname = window.location.pathname;
    return pathname.substring(pathname.lastIndexOf("/") + 1);
}

function getPreviouslyViewed() {
    const savedData = localStorage.getItem(PREVIOUSLY_VIEWED_ID);
    if (savedData) {
        return JSON.parse(savedData);
    } else {
        return [];
    }
}

function viewpreviouslyViewed() {
    const ul = document.querySelector("#previouslyViewed ul");
    const savedData = getPreviouslyViewed();
    if (savedData.length >= 1) {
        // This header is hidden by default
        document.querySelector("#previouslyViewed h2").setAttribute("style", "");
    }
    for (let i = 0; i < savedData.length; i++) {
        const hash = savedData[i];
        const a = document.createElement("a");
        a.setAttribute("href", window.location.origin + "/" + hash);
        const li = document.createElement("li");
        li.innerText = hash;

        a.appendChild(li)
        ul.appendChild(a);
    }
}

function addPreviouslyViewed() {
    const savedData = getPreviouslyViewed();
    savedData.push(getHash());
    localStorage.setItem(PREVIOUSLY_VIEWED_ID, JSON.stringify(Array.from(new Set(savedData))));
}
