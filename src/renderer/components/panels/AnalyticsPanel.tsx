import { useEffect, useState } from 'react';

export function AnalyticsPanel(): JSX.Element {
  const [kibanaUrl, setKibanaUrl] = useState<string | null>(null);

  useEffect(() => {
    window.kinetic
      .storeGet('kibanaUrl')
      .then((value) => {
        if (typeof value === 'string' && value.trim()) setKibanaUrl(value);
      })
      .catch((error) => console.warn('Unable to load kibanaUrl from store', error));
  }, []);

  const openKibana = () => {
    if (!kibanaUrl) return;
    window.open(kibanaUrl, '_blank');
  };

  return (
    <div className="card">
      <h3>Analytics</h3>
      <p style={{ margin: '0 0 10px', color: 'var(--text-secondary)', fontSize: 13 }}>
        Elastic telemetry is being batched every 5 seconds. Use Kibana for trend dashboards and percentile
        comparisons.
      </p>
      <button className="btn btn-secondary" type="button" onClick={openKibana} disabled={!kibanaUrl}>
        {kibanaUrl ? 'Open Kibana' : 'Kibana not configured'}
      </button>
    </div>
  );
}
