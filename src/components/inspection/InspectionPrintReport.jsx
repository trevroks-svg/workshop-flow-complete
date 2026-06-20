import React from 'react';
import { INSPECTION_ITEMS } from './MultiPointSection';

const formatDT = (v) => {
  if (!v) return '';
  const s = String(v);
  const hasZone = s.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(s);
  const d = new Date(hasZone ? s : `${s}Z`);
  return d.toLocaleString('en-AU', { timeZone: 'Australia/Adelaide', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
};

const CATEGORIES = [...new Set(INSPECTION_ITEMS.map(i => i.category))];

function ragDot(status) {
  if (status === 'green') return { symbol: '●', color: '#16a34a' };
  if (status === 'amber') return { symbol: '●', color: '#d97706' };
  if (status === 'red') return { symbol: '●', color: '#dc2626' };
  return { symbol: '○', color: '#94a3b8' };
}

function mmBrakeColor(val) {
  if (!val) return '#374151';
  const n = parseInt(val);
  if (n <= 2) return '#dc2626';
  if (n <= 3) return '#d97706';
  return '#16a34a';
}

function mmTyreColor(val) {
  if (!val) return '#374151';
  if (val === 'Below 1 mm') return '#dc2626';
  const n = parseInt(val);
  if (n <= 2) return '#dc2626';
  if (n <= 3) return '#d97706';
  return '#16a34a';
}

export default function InspectionPrintReport({ form, inspection }) {
  const multipoint = form.multipoint_inspection || {};
  const brakes = form.brake_measurements || {};
  const tyres = form.tyre_measurements || {};

  const redItems = INSPECTION_ITEMS.filter(i => multipoint[i.id]?.status === 'red');
  const amberItems = INSPECTION_ITEMS.filter(i => multipoint[i.id]?.status === 'amber');

  return (
    <div id="inspection-print-root" style={{ fontFamily: 'Arial, sans-serif', fontSize: '11px', color: '#111', background: '#fff', padding: '20mm 18mm', maxWidth: '210mm', margin: '0 auto', boxSizing: 'border-box' }}>

      {/* Header */}
      <div style={{ borderBottom: '2px solid #111', paddingBottom: '8px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>Vehicle Inspection Report</h1>
          <p style={{ margin: '2px 0 0', color: '#555', fontSize: '10px' }}>
            {inspection?.submitted_at ? `Submitted: ${formatDT(inspection.submitted_at)}` : ''}
            {inspection?.reviewed_at ? `  |  Reviewed: ${formatDT(inspection.reviewed_at)}` : ''}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ margin: 0, fontWeight: 'bold', fontSize: '14px' }}>Job #{form.job_card_number || '—'}</p>
          <p style={{ margin: 0, fontSize: '10px', color: '#555' }}>
            Status: <span style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>{inspection?.status || '—'}</span>
          </p>
        </div>
      </div>

      {/* Vehicle & Customer Details */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '14px', background: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
        {[
          ['Customer', form.customer_name],
          ['Vehicle', form.vehicle_make_model],
          ['Registration', form.vehicle_registration],
          ['Odometer', form.odometer ? `${form.odometer} km` : '—'],
          // Technician name hidden for privacy
        ].map(([label, value]) => (
          <div key={label}>
            <span style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
            <p style={{ margin: '1px 0 0', fontWeight: '600', fontSize: '11px' }}>{value || '—'}</p>
          </div>
        ))}
      </div>

      {/* Attention Summary */}
      {(redItems.length > 0 || amberItems.length > 0) && (
        <div style={{ marginBottom: '14px', padding: '8px 10px', border: '1.5px solid #dc2626', borderRadius: '6px', background: '#fff5f5' }}>
          <p style={{ fontWeight: 'bold', fontSize: '11px', color: '#dc2626', margin: '0 0 5px' }}>⚠ Items Requiring Attention</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px' }}>
            {redItems.map(item => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ color: '#dc2626', fontSize: '12px' }}>●</span>
                <span style={{ fontSize: '10px', fontWeight: '600' }}>{item.label}</span>
                {multipoint[item.id]?.notes && <span style={{ color: '#555', fontSize: '9px' }}>— {multipoint[item.id].notes}</span>}
              </div>
            ))}
            {amberItems.map(item => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ color: '#d97706', fontSize: '12px' }}>●</span>
                <span style={{ fontSize: '10px' }}>{item.label}</span>
                {multipoint[item.id]?.notes && <span style={{ color: '#555', fontSize: '9px' }}>— {multipoint[item.id].notes}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Brake & Tyre Measurements side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>

        {/* Brakes */}
        <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
          <div style={{ background: '#1e293b', color: '#fff', padding: '5px 10px', fontWeight: 'bold', fontSize: '10px' }}>BRAKE MEASUREMENTS</div>
          <div style={{ padding: '8px 10px' }}>
            <p style={{ fontSize: '9px', color: '#6b7280', textTransform: 'uppercase', margin: '0 0 4px' }}>Pad Thickness</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginBottom: '8px' }}>
              {[['FL', brakes.front_left], ['FR', brakes.front_right], ['RL', brakes.rear_left], ['RR', brakes.rear_right]].map(([pos, val]) => (
                <div key={pos} style={{ textAlign: 'center', background: '#f8fafc', padding: '4px', borderRadius: '4px' }}>
                  <div style={{ fontSize: '9px', color: '#6b7280' }}>{pos}</div>
                  <div style={{ fontWeight: 'bold', fontSize: '12px', color: val ? mmBrakeColor(val) : '#94a3b8' }}>{val ? `${val}mm` : '—'}</div>
                </div>
              ))}
            </div>
            <p style={{ fontSize: '9px', color: '#6b7280', textTransform: 'uppercase', margin: '0 0 4px' }}>Disc Condition</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
              {[['Front', brakes.front_disc_condition], ['Rear', brakes.rear_disc_condition]].map(([pos, val]) => (
                <div key={pos} style={{ textAlign: 'center', background: '#f8fafc', padding: '4px', borderRadius: '4px' }}>
                  <div style={{ fontSize: '9px', color: '#6b7280' }}>{pos}</div>
                  <div style={{ fontWeight: '600', fontSize: '10px', color: val === 'Requires Attention' ? '#dc2626' : val === 'Worn' || val === 'Scored' ? '#d97706' : '#16a34a' }}>{val || '—'}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tyres */}
        <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
          <div style={{ background: '#1e293b', color: '#fff', padding: '5px 10px', fontWeight: 'bold', fontSize: '10px' }}>TYRE MEASUREMENTS</div>
          <div style={{ padding: '8px 10px' }}>
            <p style={{ fontSize: '9px', color: '#6b7280', textTransform: 'uppercase', margin: '0 0 4px' }}>Tread Depth</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginBottom: '8px' }}>
              {[['FL', tyres.front_left], ['FR', tyres.front_right], ['RL', tyres.rear_left], ['RR', tyres.rear_right], ['Spare', tyres.spare]].map(([pos, val]) => (
                <div key={pos} style={{ textAlign: 'center', background: '#f8fafc', padding: '4px', borderRadius: '4px' }}>
                  <div style={{ fontSize: '9px', color: '#6b7280' }}>{pos}</div>
                  <div style={{ fontWeight: 'bold', fontSize: '12px', color: val ? mmTyreColor(val) : '#94a3b8' }}>{val ? (val.includes('mm') ? val : `${val}mm`) : '—'}</div>
                </div>
              ))}
            </div>
            <p style={{ fontSize: '9px', color: '#6b7280', textTransform: 'uppercase', margin: '0 0 4px' }}>Wear Pattern</p>
            <div style={{ background: '#f8fafc', padding: '4px', borderRadius: '4px', fontWeight: '600', fontSize: '10px' }}>{tyres.wear_pattern || '—'}</div>
          </div>
        </div>
      </div>

      {/* Multipoint Inspection Table */}
      <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden', marginBottom: '14px' }}>
        <div style={{ background: '#1e293b', color: '#fff', padding: '5px 10px', fontWeight: 'bold', fontSize: '10px' }}>MULTIPOINT INSPECTION</div>
        <div style={{ padding: '6px 8px' }}>
          {CATEGORIES.map(category => {
            const items = INSPECTION_ITEMS.filter(i => i.category === category);
            return (
              <div key={category} style={{ marginBottom: '8px' }}>
                <p style={{ fontSize: '8px', fontWeight: 'bold', textTransform: 'uppercase', color: '#6b7280', letterSpacing: '0.08em', margin: '0 0 3px', borderBottom: '1px solid #f1f5f9', paddingBottom: '2px' }}>{category}</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px' }}>
                  {items.map(item => {
                    const val = multipoint[item.id] || {};
                    const dot = ragDot(val.status);
                    return (
                      <div key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '5px', padding: '2px 0' }}>
                        <span style={{ color: dot.color, fontSize: '13px', lineHeight: '14px', flexShrink: 0 }}>{dot.symbol}</span>
                        <div>
                          <span style={{ fontSize: '10px' }}>{item.label}</span>
                          {val.notes && <div style={{ fontSize: '9px', color: '#6b7280', fontStyle: 'italic' }}>{val.notes}</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        {/* Legend */}
        <div style={{ borderTop: '1px solid #e2e8f0', padding: '4px 10px', display: 'flex', gap: '14px', background: '#f8fafc' }}>
          {[['#16a34a', 'OK'], ['#d97706', 'Monitor'], ['#dc2626', 'Action Required'], ['#94a3b8', 'Not Checked']].map(([color, label]) => (
            <span key={label} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '9px' }}>
              <span style={{ color, fontSize: '12px' }}>●</span>{label}
            </span>
          ))}
        </div>
      </div>

      {/* Diagnostic Notes */}
      {(form.diagnostic_concern || form.diagnostic_cause || form.diagnostic_correction) && (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden', marginBottom: '14px' }}>
          <div style={{ background: '#1e293b', color: '#fff', padding: '5px 10px', fontWeight: 'bold', fontSize: '10px' }}>DIAGNOSTIC NOTES</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: '8px 10px', gap: '10px' }}>
            {[['Concern', form.diagnostic_concern], ['Cause', form.diagnostic_cause], ['Correction', form.diagnostic_correction]].map(([label, val]) => (
              <div key={label}>
                <p style={{ fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', color: '#6b7280', margin: '0 0 3px' }}>{label}</p>
                <p style={{ fontSize: '10px', margin: 0, whiteSpace: 'pre-wrap' }}>{val || '—'}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Technician Notes */}
      {form.technician_notes && (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden', marginBottom: '14px' }}>
          <div style={{ background: '#1e293b', color: '#fff', padding: '5px 10px', fontWeight: 'bold', fontSize: '10px' }}>TECHNICIAN NOTES</div>
          <div style={{ padding: '8px 10px' }}>
            <p style={{ fontSize: '10px', margin: 0, whiteSpace: 'pre-wrap' }}>{form.technician_notes}</p>
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#94a3b8' }}>
        <span>Vehicle Inspection Report — Job #{form.job_card_number}</span>
        <span>Printed: {new Date().toLocaleDateString('en-AU', { timeZone: 'Australia/Adelaide', day: '2-digit', month: 'short', year: 'numeric' })}</span>
      </div>
    </div>
  );
}