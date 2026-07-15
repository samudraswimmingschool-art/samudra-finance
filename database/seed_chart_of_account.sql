-- Chart of Account — Samudra Swimming School (40 akun)
-- Aman dijalankan berulang: ON CONFLICT akan meng-update, bukan menggandakan.
insert into accounts (org_id, code, name, type, branch, normal_side, statement, pay_source)
values
  ((select id from org where name='Samudra Swimming School'), '1-10001', 'Bank Mandiri', 'Kas & Bank', null, 'Db', 'NRC', null),
  ((select id from org where name='Samudra Swimming School'), '1-10002', 'Bank BCA', 'Kas & Bank', null, 'Db', 'NRC', null),
  ((select id from org where name='Samudra Swimming School'), '1-10006', 'Piutang', 'Akun Piutang', null, 'Db', 'NRC', null),
  ((select id from org where name='Samudra Swimming School'), '1-10007', 'Saldo Kas (Petty Cash)', 'Kas & Bank', null, 'Db', 'NRC', null),
  ((select id from org where name='Samudra Swimming School'), '1-10705', 'Peralatan Kantor', 'Aktiva Tetap', null, 'Db', 'NRC', null),
  ((select id from org where name='Samudra Swimming School'), '3-30001', 'Modal Perusahaan', 'Ekuitas', null, 'Kr', 'NRC', null),
  ((select id from org where name='Samudra Swimming School'), '3-30003', 'Laba Bersih', 'Ekuitas', null, 'Kr', 'NRC', null),
  ((select id from org where name='Samudra Swimming School'), '4-40000', 'Pendapatan Private Progresif', 'Pendapatan', 'Progresif', 'Kr', 'LR', null),
  ((select id from org where name='Samudra Swimming School'), '4-40100', 'Pendapatan Kelas Progresif', 'Pendapatan', 'Progresif', 'Kr', 'LR', null),
  ((select id from org where name='Samudra Swimming School'), '4-40101', 'Pendapatan Grup Progresif', 'Pendapatan', 'Progresif', 'Kr', 'LR', null),
  ((select id from org where name='Samudra Swimming School'), '4-40102', 'Pendapatan Pendaftaran Siswa Baru Progresif', 'Pendapatan', 'Progresif', 'Kr', 'LR', null),
  ((select id from org where name='Samudra Swimming School'), '4-40103', 'Pendapatan Trial Progresif', 'Pendapatan', 'Progresif', 'Kr', 'LR', null),
  ((select id from org where name='Samudra Swimming School'), '4-40104', 'Pendapatan Private Saraga', 'Pendapatan', 'Saraga', 'Kr', 'LR', null),
  ((select id from org where name='Samudra Swimming School'), '4-40105', 'Pendapatan Kelas Saraga', 'Pendapatan', 'Saraga', 'Kr', 'LR', null),
  ((select id from org where name='Samudra Swimming School'), '4-40106', 'Pendapatan Grup Saraga', 'Pendapatan', 'Saraga', 'Kr', 'LR', null),
  ((select id from org where name='Samudra Swimming School'), '4-40107', 'Pendapatan Pendaftaran Siswa Baru Saraga', 'Pendapatan', 'Saraga', 'Kr', 'LR', null),
  ((select id from org where name='Samudra Swimming School'), '4-40108', 'Pendapatan Trial Saraga', 'Pendapatan', 'Saraga', 'Kr', 'LR', null),
  ((select id from org where name='Samudra Swimming School'), '5-50000', 'Pembelian Alat-Alat Latihan', 'COGS', null, 'Db', 'LR', 'kas'),
  ((select id from org where name='Samudra Swimming School'), '5-50001', 'Pembelian Perlengkapan Pelatih', 'COGS', null, 'Db', 'LR', 'kas'),
  ((select id from org where name='Samudra Swimming School'), '5-50002', 'Pembelian Perlengkapan Kantor', 'COGS', null, 'Db', 'LR', 'kas'),
  ((select id from org where name='Samudra Swimming School'), '6-60001', 'Gaji Pelatih Private Progresif', 'Beban Op', 'Progresif', 'Db', 'LR', 'bank'),
  ((select id from org where name='Samudra Swimming School'), '6-60002', 'Gaji Pelatih Kelas Progresif', 'Beban Op', 'Progresif', 'Db', 'LR', 'bank'),
  ((select id from org where name='Samudra Swimming School'), '6-60003', 'Gaji Karyawan Progresif', 'Beban Op', 'Progresif', 'Db', 'LR', 'bank'),
  ((select id from org where name='Samudra Swimming School'), '6-60004', 'Biaya Incharge Progresif', 'Beban Op', 'Progresif', 'Db', 'LR', 'bank'),
  ((select id from org where name='Samudra Swimming School'), '6-60005', 'THR', 'Beban Op', 'Progresif', 'Db', 'LR', 'bank'),
  ((select id from org where name='Samudra Swimming School'), '6-60006', 'TMT', 'Beban Op', 'Progresif', 'Db', 'LR', 'bank'),
  ((select id from org where name='Samudra Swimming School'), '6-60007', 'Reward Pelatih & Karyawan', 'Beban Op', 'Progresif', 'Db', 'LR', 'bank'),
  ((select id from org where name='Samudra Swimming School'), '6-60022', 'Gaji Pelatih Private Saraga', 'Beban Op', 'Saraga', 'Db', 'LR', 'bank'),
  ((select id from org where name='Samudra Swimming School'), '6-60023', 'Gaji Pelatih Kelas Saraga', 'Beban Op', 'Saraga', 'Db', 'LR', 'bank'),
  ((select id from org where name='Samudra Swimming School'), '6-60024', 'Gaji Karyawan Saraga', 'Beban Op', 'Saraga', 'Db', 'LR', 'bank'),
  ((select id from org where name='Samudra Swimming School'), '6-60025', 'Biaya Incharge Saraga', 'Beban Op', 'Saraga', 'Db', 'LR', 'bank'),
  ((select id from org where name='Samudra Swimming School'), '6-60010', 'Alat Tulis Kantor', 'Beban Kas', null, 'Db', 'LR', 'kas'),
  ((select id from org where name='Samudra Swimming School'), '6-60011', 'Iklan', 'Beban Kas', null, 'Db', 'LR', 'kas'),
  ((select id from org where name='Samudra Swimming School'), '6-60013', 'Air Minum', 'Beban Kas', null, 'Db', 'LR', 'kas'),
  ((select id from org where name='Samudra Swimming School'), '6-60016', 'Dana Komunikasi', 'Beban Kas', null, 'Db', 'LR', 'kas'),
  ((select id from org where name='Samudra Swimming School'), '6-60017', 'Pembayaran Canva/Website', 'Beban Kas', null, 'Db', 'LR', 'kas'),
  ((select id from org where name='Samudra Swimming School'), '6-60021', 'Event/Kegiatan/Gathering', 'Beban Kas', null, 'Db', 'LR', 'kas'),
  ((select id from org where name='Samudra Swimming School'), '7-70000', 'Pendapatan Penjualan Aset', 'Other Income', null, 'Kr', 'LR', null),
  ((select id from org where name='Samudra Swimming School'), '7-70099', 'Pendapatan Bunga', 'Other Income', null, 'Kr', 'LR', null),
  ((select id from org where name='Samudra Swimming School'), '8-00001', 'Penyesuaian Persediaan', 'Other Expense', null, 'Db', 'LR', 'kas')
on conflict (org_id, code) do update
  set name=excluded.name, type=excluded.type, branch=excluded.branch,
      normal_side=excluded.normal_side, statement=excluded.statement,
      pay_source=excluded.pay_source;

-- Verifikasi:
-- select code, name, type, branch, pay_source from accounts order by code;
