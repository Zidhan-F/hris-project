import { formatCurrency } from '../../utils/helpers';

const PTKP_TABLE = {
  'TK/0': 54000000, 'TK/1': 58500000, 'TK/2': 63000000, 'TK/3': 67500000,
  'K/0': 58500000, 'K/1': 63000000, 'K/2': 67500000, 'K/3': 72000000,
};

function calculatePPh21(baseSalary, ptkpStatus) {
  const annualGross = baseSalary * 12;
  const ptkp = PTKP_TABLE[ptkpStatus] || PTKP_TABLE['TK/0'];
  const pkp = Math.max(0, annualGross - ptkp);
  let tax = 0;
  if (pkp <= 60000000) tax = pkp * 0.05;
  else if (pkp <= 250000000) tax = 60000000 * 0.05 + (pkp - 60000000) * 0.15;
  else if (pkp <= 500000000) tax = 60000000 * 0.05 + 190000000 * 0.15 + (pkp - 250000000) * 0.25;
  else tax = 60000000 * 0.05 + 190000000 * 0.15 + 250000000 * 0.25 + (pkp - 500000000) * 0.30;
  return Math.round(tax / 12);
}


export default function EditPayrollModal({ editPayrollData, setEditPayrollData, handleSavePayroll, isSavingPayroll, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content animate-fadeInUp" style={{ maxWidth: '560px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header" style={{ flexShrink: 0 }}>
          <h3>
            <span className="material-icons-outlined" style={{ fontSize: 20, verticalAlign: 'middle', marginRight: 6, color: '#2563eb' }}>edit_note</span>
            Edit Payroll: {editPayrollData.name}
          </h3>
          <button className="modal-close" onClick={onClose}><span className="material-icons-outlined">close</span></button>
        </div>
        <form onSubmit={handleSavePayroll} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div className="edit-profile-form" style={{ overflowY: 'auto', flex: 1 }}>

            {/* Section: Gaji */}
            <div className="payroll-modal-section-label">
              <span className="material-icons-outlined">payments</span> Informasi Gaji
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Gaji Pokok (IDR)</label>
                <input type="number" value={editPayrollData.baseSalary} onChange={e => setEditPayrollData({ ...editPayrollData, baseSalary: Number(e.target.value) })} min="0" required />
              </div>
              <div className="form-group">
                <label>Tunjangan / Bonus (IDR)</label>
                <input type="number" value={editPayrollData.allowance} onChange={e => setEditPayrollData({ ...editPayrollData, allowance: Number(e.target.value) })} min="0" required />
              </div>
            </div>

            {/* Section: Uang Harian */}
            <div className="payroll-modal-section-label">
              <span className="material-icons-outlined">restaurant</span> Uang Harian (Per Hari Hadir)
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Uang Makan / Hari (IDR)</label>
                <input type="number" value={editPayrollData.mealAllowanceRate ?? 25000} onChange={e => setEditPayrollData({ ...editPayrollData, mealAllowanceRate: Number(e.target.value) })} min="0" />
              </div>
              <div className="form-group">
                <label>Uang Transport / Hari (IDR)</label>
                <input type="number" value={editPayrollData.transportAllowanceRate ?? 20000} onChange={e => setEditPayrollData({ ...editPayrollData, transportAllowanceRate: Number(e.target.value) })} min="0" />
              </div>
            </div>

            {/* Section: Bank */}
            <div className="payroll-modal-section-label">
              <span className="material-icons-outlined">account_balance</span> Informasi Rekening
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Nama Bank</label>
                <select value={editPayrollData.bankName || '-'} onChange={e => setEditPayrollData({ ...editPayrollData, bankName: e.target.value })}>
                  <option value="-">— Pilih Bank —</option>
                  <option value="BCA">BCA</option>
                  <option value="Mandiri">Mandiri</option>
                  <option value="BNI">BNI</option>
                  <option value="BRI">BRI</option>
                  <option value="CIMB Niaga">CIMB Niaga</option>
                  <option value="Danamon">Danamon</option>
                  <option value="Permata">Permata</option>
                  <option value="OCBC NISP">OCBC NISP</option>
                  <option value="BSI">BSI</option>
                  <option value="BTN">BTN</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </div>
              <div className="form-group">
                <label>No. Rekening</label>
                <input value={editPayrollData.bankAccount || ''} onChange={e => setEditPayrollData({ ...editPayrollData, bankAccount: e.target.value })} placeholder="" />
              </div>
            </div>

            {/* Section: Pajak & Status */}
            <div className="payroll-modal-section-label">
              <span className="material-icons-outlined">receipt_long</span> Pajak & Status
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Status PTKP (PPh 21)</label>
                <select value={editPayrollData.ptkpStatus || 'TK/0'} onChange={e => setEditPayrollData({ ...editPayrollData, ptkpStatus: e.target.value })}>
                  <option value="TK/0">TK/0 — Tidak Kawin, 0 Tanggungan</option>
                  <option value="TK/1">TK/1 — Tidak Kawin, 1 Tanggungan</option>
                  <option value="TK/2">TK/2 — Tidak Kawin, 2 Tanggungan</option>
                  <option value="TK/3">TK/3 — Tidak Kawin, 3 Tanggungan</option>
                  <option value="K/0">K/0 — Kawin, 0 Tanggungan</option>
                  <option value="K/1">K/1 — Kawin, 1 Tanggungan</option>
                  <option value="K/2">K/2 — Kawin, 2 Tanggungan</option>
                  <option value="K/3">K/3 — Kawin, 3 Tanggungan</option>
                </select>
              </div>
              <div className="form-group">
                <label>Status Payroll</label>
                <select value={editPayrollData.payrollStatus} onChange={e => setEditPayrollData({ ...editPayrollData, payrollStatus: e.target.value })} required>
                  <option value="Unpaid">Unpaid</option>
                  <option value="Paid">Paid</option>
                </select>
              </div>
            </div>

            {/* Section: Potongan Manual */}
            <div className="payroll-modal-section-label">
              <span className="material-icons-outlined">remove_circle_outline</span> Potongan Manual (Opsional)
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>BPJS Kesehatan (IDR) {editPayrollData.bpjsKesehatanAmount === 1 && <small style={{ color: '#2563eb' }}>(Otomatis)</small>}</label>
                <input type="number" value={editPayrollData.bpjsKesehatanAmount} onChange={e => setEditPayrollData({ ...editPayrollData, bpjsKesehatanAmount: Number(e.target.value) })} min="0" placeholder="0=Matikan, 1=Otomatis" />
                <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>0=Nonaktif, 1=Otomatis</div>
              </div>
              <div className="form-group">
                <label>BPJS TK (IDR) {editPayrollData.bpjsTkAmount === 1 && <small style={{ color: '#2563eb' }}>(Otomatis)</small>}</label>
                <input type="number" value={editPayrollData.bpjsTkAmount} onChange={e => setEditPayrollData({ ...editPayrollData, bpjsTkAmount: Number(e.target.value) })} min="0" placeholder="0=Matikan, 1=Otomatis" />
                <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>0=Nonaktif, 1=Otomatis</div>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group" style={{ maxWidth: '50%' }}>
                <label>PPh 21 (IDR) {editPayrollData.pph21Amount === 1 && <small style={{ color: '#2563eb' }}>(Otomatis)</small>}</label>
                <input type="number" value={editPayrollData.pph21Amount} onChange={e => setEditPayrollData({ ...editPayrollData, pph21Amount: Number(e.target.value) })} min="0" placeholder="0=Matikan, 1=Otomatis" />
                <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>0=Nonaktif, 1=Otomatis</div>
              </div>
            </div>



            {/* Preview THP */}
            <div className="payroll-modal-preview">
              <div className="pmp-row">
                <span>Gaji Pokok</span>
                <strong>{formatCurrency(editPayrollData.baseSalary || 0)}</strong>
              </div>
              <div className="pmp-row">
                <span>Tunjangan</span>
                <strong>+ {formatCurrency(editPayrollData.allowance || 0)}</strong>
              </div>
              <div className="pmp-row">
                <span>Uang Makan (22 hari)</span>
                <strong>+ {formatCurrency((editPayrollData.mealAllowanceRate ?? 25000) * 22)}</strong>
              </div>
              <div className="pmp-row">
                <span>Uang Transport (22 hari)</span>
                <strong>+ {formatCurrency((editPayrollData.transportAllowanceRate ?? 20000) * 22)}</strong>
              </div>
              <div className="pmp-row total">
                <span>💰 Estimasi THP (22 hari kerja)</span>
                {(() => {
                  const base = editPayrollData.baseSalary || 0;
                  const eBpjsKes = editPayrollData.bpjsKesehatanAmount === 1 ? Math.round(base * 0.01) : editPayrollData.bpjsKesehatanAmount;
                  const eBpjsTk = editPayrollData.bpjsTkAmount === 1 ? Math.round(base * 0.02) : editPayrollData.bpjsTkAmount;
                  const ePph21 = editPayrollData.pph21Amount === 1 ? calculatePPh21(base, editPayrollData.ptkpStatus) : editPayrollData.pph21Amount;

                  return (
                    <strong>{formatCurrency(
                      base +
                      (editPayrollData.allowance || 0) +
                      ((editPayrollData.mealAllowanceRate ?? 25000) * 22) +
                      ((editPayrollData.transportAllowanceRate ?? 20000) * 22) -
                      eBpjsKes - eBpjsTk - ePph21
                    )}</strong>
                  );
                })()}
              </div>

            </div>


          </div>
          <div className="modal-footer" style={{ flexShrink: 0 }}>
            <button type="button" className="btn-cancel" onClick={onClose}>Batal</button>
            <button type="submit" className="btn-save" disabled={isSavingPayroll}>
              {isSavingPayroll ? <div className="loading-spinner"></div> : 'Simpan Perubahan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
