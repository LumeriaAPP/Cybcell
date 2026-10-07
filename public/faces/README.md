# Portrait attribution

The ten portraits in `public/data/faces.json` depict real people. Display names
and bilingual profile descriptions are fictional presentation text, not the
subjects' identities or biographies. No nationality, endorsement, or actual
working relationship with CYBCELL has been verified for the photographed subjects.

All ten photographs are CC BY 2.0, with individual photo titles, photographer
credits, original Flickr links and license URLs in `credits.html`, the `credit`
fields of `faces.json`, and `photo-provenance.json`. Keep a visible link to
`/faces/credits.html` on the gallery while these photos are in use. The original
640×960 JPEG derivatives were converted to 640×800 top-aligned crops and WebP
quality 85 for six portraits. Four replacement portraits are the untransformed
640×960 JPEGs, displayed using CSS cropping. Individual processing details are
disclosed beside each photo credit and recorded in the provenance file.

Permission evidence comes from the source repository's photo-specific README,
pinned to commit `c1d95c78ec2fe47bc4d045aca5b502010ad21eac`. Original source and asset hashes are preserved
in `photo-provenance.json`. The Flickr and Creative Commons websites were
blocked in this execution environment, so their live pages could not be
independently rechecked; the repository's recorded photo-level license is the
evidence used. The source records the original photos as CC-licensed when
downloaded on April 28, 2011. Its MIT code license is not used to license photos.

No synthetic images, minor-titled portraits, or the repository's identified
Monica Bellucci photo are included. No nationality is attributed to a subject.
Do not run `tools/make_faces_demo.py` over this set; that script regenerates
the previous placeholder data. Replace these presentation profiles with the team's supplied,
permission-cleared portraits when actual profiles are ready.
