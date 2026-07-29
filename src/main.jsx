import React from 'react';
import { createRoot } from 'react-dom/client';
import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  signInWithCustomToken
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getFirestore,
  onSnapshot,
  setDoc
} from 'firebase/firestore';
import App from './App.jsx';
import { registerPwa } from './pwa/registerPwa.js';
import './styles/app.css';
import './styles/pwa-mobile.css';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
window.pdfjsLib = pdfjsLib;
window.firebaseImports = {
  initializeApp,
  getAuth,
  signInWithCustomToken,
  signInAnonymously,
  onAuthStateChanged,
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot
};
window.dispatchEvent(new Event('pdfjs-ready'));

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

registerPwa();
