import type { Metadata } from 'next';

export default function Head() {
  return (
    <>
      <title>Baytech Mortgage ERP</title>
      <meta content="width=device-width, initial-scale=1" name="viewport" />
      <meta name="description" content="Complete mortgage ERP system with employee management, lead tracking, and attendance monitoring" />
      <link rel="icon" href="/baytechlogo.svg" type="image/svg+xml" />
      <link rel="icon" href="/favicon.ico" type="image/x-icon" />
      <link rel="shortcut icon" href="/baytechlogo.svg" type="image/svg+xml" />
      <link rel="apple-touch-icon" href="/baytechlogo.svg" />
      <meta name="msapplication-TileImage" content="/baytechlogo.svg" />
      <meta name="msapplication-TileColor" content="#ffffff" />
      <meta property="og:title" content="Baytech Mortgage ERP" />
      <meta property="og:description" content="Complete mortgage ERP system" />
      <meta property="og:type" content="website" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content="Baytech Mortgage ERP" />
      <meta name="twitter:description" content="Complete mortgage ERP system" />
    </>
  );
}