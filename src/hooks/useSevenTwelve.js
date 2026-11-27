// import { useEffect, useState } from 'react';
// import { doc, onSnapshot } from 'firebase/firestore';
// import { db } from '../firebase/config'; // adjust to where your Firestore instance lives

// /* Where each project (map) keeps its own record. Change this if your maps
//    live in a different collection. */
// const MAPS_COLLECTION = 'maps';

// /**
//  * The 7/12 extract of ONE project. Every plot in that project shows the
//  * same file, and a different project shows its own. The URL is cleared the
//  * moment mapId changes, so project A's file can never appear on project B
//  * while B is still loading.
//  */
// export function useSevenTwelve(mapId) {
//   const [url, setUrl] = useState('');

//   useEffect(() => {
//     setUrl(''); // show a loading image while the real URL is fetched
//     if (!mapId) return undefined;

//     return onSnapshot(
//       doc(db, MAPS_COLLECTION, mapId),
//       (snap) => {
//         const d = snap.data() || {};
//         setUrl(d.sevenTwelveUrl || d.sevenTwelve?.url || '');
//       },
//       () => setUrl(''),
//     );
//   }, [mapId]);

//   return url;
// }



import { useEffect, useState } from 'react';

/* Each project's 7/12 lives at public/712/<mapId>.pdf
   e.g. public/712/mZMnCFJ7crzKPYsW1IWs.pdf  ->  /712/mZMnCFJ7crzKPYsW1IWs.pdf
   A project with no file there simply gets disabled buttons. */
export function useSevenTwelve(mapId) {
  const [url, setUrl] = useState('');

  useEffect(() => {
    setUrl('');
    if (!mapId) return undefined;

    const href = `/712/${encodeURIComponent(mapId)}.pdf`;
    let alive = true;

    fetch(href, { method: 'HEAD' })
      .then((r) => {
        /* A missing file can come back as the site's index.html with a 200,
           so the content type has to say PDF. */
        const isPdf = r.ok && (r.headers.get('content-type') || '').includes('pdf');
        if (alive) setUrl(isPdf ? href : '');
      })
      .catch(() => { if (alive) setUrl(''); });

    return () => { alive = false; };
  }, [mapId]);

  return url;
}