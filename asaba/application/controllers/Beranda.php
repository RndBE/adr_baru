<?php

class Beranda extends CI_Controller
{

	public function __construct()
	{
		parent::__construct();
		$this->load->helper('coordinates');
	}

	private function get_rts_by_site($site)
	{
		if ($site === 'ccp') return ['E' => 525952.000, 'N' => 401320.988, 'Z' => 62.559];
		return ['E' => 526904.411, 'N' => 402826.049, 'Z' => 53.751];
	}

	private function nfloat($v)
	{
		if ($v === null) return 0.0;
		if (is_numeric($v)) return (float)$v;
		$s = trim((string)$v);
		if ($s === '' || $s === '000,00,00' || $s === '000.00.00') return 0.0;
		$s = str_replace(',', '.', $s);
		$s = preg_replace('/[^0-9\.\-]/', '', $s);
		if ($s === '' || $s === '-' || $s === '.' || $s === '-.') return 0.0;
		return (float)$s;
	}

	private function fmt($v, $d = 3)
	{
		return number_format((float)$v, (int)$d, '.', '');
	}

	private function status_pergeseran($mm, $site)
	{
		$mm = (float)$mm;
		if ($site === 'ccp') {
			if ($mm < 100) return ['label' => 'Normal', 'class' => 'bg-success-lt text-dark'];
			if ($mm < 200) return ['label' => 'Waspada', 'class' => 'bg-warning-lt text-dark'];
			if ($mm < 400) return ['label' => 'Siaga', 'class' => 'bg-orange-lt text-dark'];
			return ['label' => 'Awas', 'class' => 'bg-danger-lt text-white'];
		}
		if ($mm < 50) return ['label' => 'Normal', 'class' => 'bg-success-lt text-dark'];
		if ($mm < 100) return ['label' => 'Waspada', 'class' => 'bg-warning-lt text-dark'];
		if ($mm < 200) return ['label' => 'Siaga', 'class' => 'bg-orange-lt text-dark'];
		return ['label' => 'Awas', 'class' => 'bg-danger-lt text-white'];
	}

	private function status_kecepatan($mm_per_day, $site)
	{
		$mmd = (float)$mm_per_day;
		$level_d = 0;
		if ($site === 'ccp') {
			if ($mmd > 150) $level_d = 3;
			else if ($mmd > 100) $level_d = 2;
			else if ($mmd > 50) $level_d = 1;
		} else {
			if ($mmd > 120) $level_d = 3;
			else if ($mmd > 80) $level_d = 2;
			else if ($mmd > 40) $level_d = 1;
		}
		if ($level_d === 0) return ['label' => 'Normal', 'class' => 'bg-success-lt text-dark'];
		if ($level_d === 1) return ['label' => 'Waspada', 'class' => 'bg-warning-lt text-dark'];
		if ($level_d === 2) return ['label' => 'Siaga', 'class' => 'bg-orange-lt text-dark'];
		return ['label' => 'Awas', 'class' => 'bg-danger-lt text-white'];
	}

	public function get_deformasi_json($id_log)
	{
		$log = $this->db->where('id_log', $id_log)->get('log_kontrol')->row();
		if (!$log) {
			return $this->output
				->set_status_header(404)
				->set_content_type('application/json')
				->set_output(json_encode(['error' => 'id_log tidak ditemukan'], JSON_UNESCAPED_UNICODE));
		}

		$site = isset($log->site) ? $log->site : 'unknown';
		$datetime = isset($log->datetime) ? $log->datetime : date('Y-m-d H:i:s');

		$lokasi_rts = $this->get_rts_by_site($site);

		$log_first_row = $this->db->where('site', $site)->where('r0', '1')->get('log_kontrol')->row();
		if (!$log_first_row) {
			$log_first_row = $this->db->where('site', $site)->order_by('datetime', 'asc')->limit(1)->get('log_kontrol')->row();
		}
		$log_first = $log_first_row ? $log_first_row->id_log : $id_log;

		$rts_logger_ids = $this->db->distinct()->select('id_logger')->get('t_prisma')->result_array();

		$data_pengukuran = [];
		foreach ($rts_logger_ids as $lg) {
			$id_logger = $lg['id_logger'];

			$prisms = $this->db
				->join('temp_prisma', 'temp_prisma.id_prisma = t_prisma.id_prisma', 'left')
				->where('t_prisma.id_logger', $id_logger)
				->get('t_prisma')
				->result_array();

			foreach ($prisms as $p) {
				$id_prisma = isset($p['id_prisma']) ? $p['id_prisma'] : null;
				if (!$id_prisma) continue;

				$cek_tembak = $this->db
					->where('id_kontrol', $id_log)
					->where('sensor1', $id_prisma)
					->get('rts')
					->row();

				$first_data = $this->db
					->where('id_kontrol', $log_first)
					->where('sensor1', $id_prisma)
					->order_by('waktu', 'asc')
					->get('rts')
					->row();

				if (!$cek_tembak || !$first_data) continue;

				$N1 = $this->nfloat($cek_tembak->sensor8);
				$E1 = $this->nfloat($cek_tembak->sensor9);
				$Z1 = $this->nfloat($cek_tembak->sensor10);

				$N0 = $this->nfloat($first_data->sensor8);
				$E0 = $this->nfloat($first_data->sensor9);
				$Z0 = $this->nfloat($first_data->sensor10);

				if ($site === 'ccp') {
					$r1 = $this->rotateEN($E1, $N1, 114);
					$E1 = $r1[0];
					$N1 = $r1[1];

					$r0 = $this->rotateEN($E0, $N0, 114);
					$E0 = $r0[0];
					$N0 = $r0[1];
				}

				$HA0 = isset($first_data->sensor5) ? $first_data->sensor5 : '';
				$VA0 = isset($first_data->sensor6) ? $first_data->sensor6 : '';
				$SD0 = isset($first_data->sensor7) ? $first_data->sensor7 : '';

				$HA1 = isset($cek_tembak->sensor5) ? $cek_tembak->sensor5 : '';
				$VA1 = isset($cek_tembak->sensor6) ? $cek_tembak->sensor6 : '';
				$SD1 = isset($cek_tembak->sensor7) ? $cek_tembak->sensor7 : '';

				$valid1 = ($N1 != 0 || $E1 != 0 || $Z1 != 0);
				$valid0 = ($N0 != 0 || $E0 != 0 || $Z0 != 0);

				if ($valid1 && $valid0) {
					$DN = $N1 - $N0;
					$DE = $E1 - $E0;
					$DZ = $Z1 - $Z0;
					$linier3d = sqrt(($DE * $DE) + ($DN * $DN) + ($DZ * $DZ));
					$linier2d = sqrt(($DE * $DE) + ($DN * $DN));
				} else {
					$DN = 0;
					$DE = 0;
					$DZ = 0;
					$linier3d = 0;
					$linier2d = 0;
				}

				$arah = '-';
				if ($linier2d > 0) {
					$tmp = $this->arah8ID($DE, $DN);
					$arah = $tmp['bearing'] . ' (' . $tmp['arah_id'] . ')';
				}

				$nama_prisma = '';
				if (isset($cek_tembak->sensor3) && $cek_tembak->sensor3 !== '') $nama_prisma = $cek_tembak->sensor3;
				else if (isset($p['nama_prisma']) && $p['nama_prisma'] !== '') $nama_prisma = $p['nama_prisma'];
				else if (isset($p['nama']) && $p['nama'] !== '') $nama_prisma = $p['nama'];

				$data_pengukuran[] = [
					'id_prisma' => $id_prisma,
					'nama_prisma' => $nama_prisma,
					'id_logger' => $id_logger,
					'waktu' => isset($cek_tembak->waktu) ? $cek_tembak->waktu : $datetime,
					'temp_tembak' => [
						'nama_prisma' => $nama_prisma,
						'N0' => $N0,
						'E0' => $E0,
						'Z0' => $Z0,
						'HA0' => $HA0,
						'VA0' => $VA0,
						'SD0' => $SD0,
						'N1' => $N1,
						'E1' => $E1,
						'Z1' => $Z1,
						'HA1' => $HA1,
						'VA1' => $VA1,
						'SD1' => $SD1,
						'DN' => $this->fmt($DN, 6),
						'DE' => $this->fmt($DE, 6),
						'DZ' => $this->fmt($DZ, 6),
						'linear' => $linier3d,
						'arah_pergeseran' => $arah
					]
				];
			}
		}

		$out = [
			'tanggal' => $datetime,
			'posisi_rts' => $lokasi_rts,
			'data_pengukuran' => $data_pengukuran
		];

		$this->output
			->set_content_type('application/json')
			->set_output(json_encode($out, JSON_UNESCAPED_UNICODE));
	}


	function view_3d()
	{
		if (!$this->session->userdata('temp_kontrol')) {
			$temp_kontrol = $this->db->order_by('datetime', 'desc')->limit(1)->get('log_kontrol')->row();
			if ($temp_kontrol) {
				$this->session->set_userdata('temp_kontrol', $temp_kontrol);
			}
		}
		$log_data = $this->db->order_by('datetime', 'desc')->get('log_kontrol')->result_array();
		$data['log_data'] = $log_data;
		$data['temp_kontrol'] = $this->session->userdata('temp_kontrol');
		$data['konten'] = 'konten/back/deformasi';
		$this->load->view('template_admin/site', $data);
	}

	public function tes_deformasi()
	{
		$raw = $this->input->post('parameter');
		$data = is_string($raw) ? json_decode($raw, true) : $raw;

		$tgl = $this->session->userdata('temp_kontrol');

		if ($tgl && isset($tgl->site) && $tgl->site == 'ccp') {
			$lokasi_rts = ['E' => 525952.000, 'N' => 401320.988, 'Z' => 62.559];
		} else {
			$lokasi_rts = ['E' => 526904.411, 'N' => 402826.049, 'Z' => 53.751];
		}

		$datetime = ($tgl && isset($tgl->datetime)) ? $tgl->datetime : date('Y-m-d H:i:s');

		$new_data = [
			'tanggal' => $datetime,
			'posisi_rts' => $lokasi_rts,
			'data_pengukuran' => is_array($data) ? $data : [],
		];

		$save_dir = FCPATH . 'file_json/';
		if (!is_dir($save_dir)) {
			mkdir($save_dir, 0775, true);
		}

		$site = ($tgl && isset($tgl->site)) ? $tgl->site : 'unknown';
		$safe_dt = preg_replace('/[^0-9]/', '', $datetime);
		$filename = 'deformasi_' . $site . '_' . $safe_dt . '.json';
		$file_path = $save_dir . $filename;

		$json_str = json_encode($new_data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
		file_put_contents($file_path, $json_str);

		$new_data['saved_file'] = base_url('uploads/deformasi_json/' . $filename);

		$this->output
			->set_content_type('application/json')
			->set_output(json_encode($new_data));
	}


	public function ubah_tanggal()
	{
		$id_log = $this->input->get('id_log');
		$data_log = $this->db->where('id_log', $id_log)->get('log_kontrol')->row();

		$this->session->set_userdata('temp_kontrol', $data_log);
		redirect('beranda');
	}

	function rotateEN($E, $N, $degree)
	{

		// Pivot = BS_1 (koordinat sebenarnya, dalam Easting – Northing)
		$pivotE = 525919.314; // <— isi dengan easting BS_1 yang benar (GNSS)
		$pivotN = 401306.514; // <— isi northing BS_1 yang benar (GNSS)

		// BS_1 hasil RTS (yang salah posisi)
		$measE = 525951.9891; // <— easting BS_1 dari RTS
		$measN = 401356.7348; // <— northing BS_1 dari RTS

		// 1) Buat vektor relatif RTS terhadap BS_1 lama
		$x = $E - $measE;
		$y = $N - $measN;

		// 2) Rotasi
		$theta = deg2rad($degree);

		$xr =  $x * cos($theta) - $y * sin($theta);
		$yr =  $x * sin($theta) + $y * cos($theta);

		// 3) Tempel ke BS_1 GNSS
		$newE = $pivotE + $xr;
		$newN = $pivotN + $yr;

		return [$newE, $newN];
	}

	function rotateCoordinate($lat, $lng, $degree)
	{

		$pivotLat = 3.630666916497659;
		$pivotLng = 117.23339499051768;

		$bs1MeasLat = 3.6311211814254656;
		$bs1MeasLng = 117.23368933432215;

		$theta = deg2rad($degree);
		$R = 6378137.0; // radius bumi

		$x = deg2rad($lng - $bs1MeasLng) * $R * cos(deg2rad($bs1MeasLat));
		$y = deg2rad($lat - $bs1MeasLat) * $R;

		$xr =  $x * cos($theta) - $y * sin($theta);
		$yr =  $x * sin($theta) + $y * cos($theta);

		$newLat = rad2deg($yr / $R + deg2rad($pivotLat));
		$newLng = rad2deg($xr / ($R * cos(deg2rad($pivotLat))) + deg2rad($pivotLng));

		return [$newLat, $newLng];
	}


	private function safe($v)
	{
		if ($v === null) return "";
		if (is_array($v) || is_object($v)) {
			return json_encode($v);
		}
		return (string)$v; // penting → paksa string
	}


	function export_excel()
	{
		include APPPATH . 'third_party/PHPExcel/PHPExcel.php';
		$excel = new PHPExcel();
		$title = $this->input->post('title');
		$excel->getProperties()->setCreator('Beacon Engineering')
			->setTitle("Data")
			->setDescription("Data Semua Parameter");
		$parameter = json_decode(json_encode($this->session->userdata('temp_prisma')));
		$sheet = $excel->setActiveSheetIndex(0);
		$style = [
			'font' => [
				'bold' => true, // Set text to bold
			],
			'fill' => [
				'type' => PHPExcel_Style_Fill::FILL_SOLID, // Set fill type
				'color' => ['rgb' => 'f5f5f5'], // Yellow background
			],
			'borders' => [
				'allborders' => [
					'style' => PHPExcel_Style_Border::BORDER_THIN, // Apply thin border
					'color' => ['rgb' => '000000'], // Border color (black)
				],
			],
		];

		$sheet->setCellValue('A5', 'Nomor Prisma');
		$sheet->setCellValue('B5', 'Nama Prisma');
		$sheet->setCellValue('C5', 'Awal Pengukuran');
		$sheet->setCellValue('C6', 'X');
		$sheet->setCellValue('D6', 'Y');
		$sheet->setCellValue('E6', 'Z');
		$sheet->setCellValue('F6', 'HA');
		$sheet->setCellValue('G6', 'VA');
		$sheet->setCellValue('H6', 'Slop Dis');
		$sheet->setCellValue('I5', 'Hasil Pengukuran');
		$sheet->setCellValue('I6', 'X');
		$sheet->setCellValue('J6', 'Y');
		$sheet->setCellValue('K6', 'Z');
		$sheet->setCellValue('L6', 'HA');
		$sheet->setCellValue('M6', 'VA');
		$sheet->setCellValue('N6', 'Slop Dis');
		$sheet->setCellValue('O5', 'Pergeseran');
		$sheet->setCellValue('O6', 'ΔX');
		$sheet->setCellValue('P6', 'ΔY');
		$sheet->setCellValue('Q6', 'ΔZ');
		$sheet->setCellValue('R6', 'Linear');
		$sheet->setCellValue('S5', 'Arah Pergeseran');
		$sheet->mergeCells('A5:A6');
		$sheet->mergeCells('B5:B6');
		$sheet->mergeCells('C5:H5');
		$sheet->mergeCells('I5:N5');
		$sheet->mergeCells('O5:R5');
		$sheet->mergeCells('S5:S6');
		$sheet->getStyle('A5')->getAlignment()->setVertical(PHPExcel_Style_Alignment::VERTICAL_CENTER);
		$sheet->getStyle('B5')->getAlignment()->setVertical(PHPExcel_Style_Alignment::VERTICAL_CENTER);
		$sheet->getStyle('S5')->getAlignment()->setVertical(PHPExcel_Style_Alignment::VERTICAL_CENTER);

		$tgl = $this->session->userdata('temp_kontrol')->datetime;

		foreach (range('A', 'S') as $columnID) {
			$sheet->getStyle($columnID . '5')->applyFromArray($style);
			$sheet->getStyle($columnID . '6')->applyFromArray($style);
			$sheet->getStyle($columnID . '5')->getAlignment()->setHorizontal(PHPExcel_Style_Alignment::HORIZONTAL_CENTER);
			$sheet->getStyle($columnID . '6')->getAlignment()->setHorizontal(PHPExcel_Style_Alignment::HORIZONTAL_CENTER);
			$sheet->getStyle($columnID . '5')->getAlignment()->setVertical(PHPExcel_Style_Alignment::VERTICAL_CENTER);
			$sheet->getStyle($columnID . '6')->getAlignment()->setVertical(PHPExcel_Style_Alignment::VERTICAL_CENTER);
			$sheet->getStyle($columnID . '1')->applyFromArray([
				'font' => [
					'bold' => true, // Set text to bold
					'size' => 14,
				],
			]);
			$sheet->getStyle($columnID . '2')->applyFromArray([
				'font' => [
					'bold' => false, // Set text to bold
					'size' => 12,
				],
			]);
		}
		$sheet->getRowDimension('1')->setRowHeight(30);
		$sheet->getRowDimension('5')->setRowHeight(22);
		$sheet->getRowDimension('6')->setRowHeight(22);
		$sheet->getStyle('A1')->getAlignment()->setVertical(PHPExcel_Style_Alignment::VERTICAL_CENTER);
		$sheet->getStyle('A2')->getAlignment()->setHorizontal(PHPExcel_Style_Alignment::HORIZONTAL_CENTER);
		$sheet->getStyle('A1')->getAlignment()->setHorizontal(PHPExcel_Style_Alignment::HORIZONTAL_CENTER);
		$style2 = [
			'font' => [
				'bold' => false, // Set text to bold
			],
			'borders' => [
				'allborders' => [
					'style' => PHPExcel_Style_Border::BORDER_THIN, // Apply thin border
					'color' => ['rgb' => '000000'], // Border color (black)
				],
			],
		];
		$sheet->getColumnDimension('A')->setWidth(13);
		$sheet->getColumnDimension('B')->setWidth(15);
		$sheet->getColumnDimension('S')->setWidth(15);
		$row = '7';
		$judul2 = $this->session->userdata('temp_kontrol')->site == 'ccp' ? 'CPP 3' : 'View Point';
		$excel->setActiveSheetIndex(0)->setCellValue('A1', 'Hasil Penembakan RTS ' . $judul2 . ' PT MIP');
		$excel->setActiveSheetIndex(0)->setCellValue('A2', 'Tanggal : ' . $tgl);
		$excel->setActiveSheetIndex(0)->mergeCells('A1:S1');
		$excel->setActiveSheetIndex(0)->mergeCells('A2:S2');
		$columns = 'A';

		foreach ($parameter as $key => $v) {

			$cl = $columns;

			if (isset($v->temp_tembak->nama_prisma)) {

				// A & B
				$sheet->setCellValue(
					$cl . $row,
					str_replace('_', ' ', $this->safe($v->id_prisma))
				);
				$sheet->setCellValue(
					'B' . $row,
					str_replace('_', ' ', $this->safe($v->temp_tembak->nama_prisma))
				);

				// Style baris A–S
				foreach (range('A', 'S') as $columnID) {
					$sheet->getStyle($columnID . $row)->applyFromArray($style2);
					$sheet->getStyle($columnID . $row)
						->getAlignment()
						->setHorizontal(PHPExcel_Style_Alignment::HORIZONTAL_CENTER);
				}

				$sheet->setCellValue('C' . $row, $this->safe($v->temp_tembak->E0));
				$sheet->setCellValue('D' . $row, $this->safe($v->temp_tembak->N0));
				$sheet->setCellValue('E' . $row, $this->safe($v->temp_tembak->Z0));
				$sheet->setCellValue('F' . $row, $this->safe($v->temp_tembak->HA0));
				$sheet->setCellValue('G' . $row, $this->safe($v->temp_tembak->VA0));
				$sheet->setCellValue('H' . $row, $this->safe($v->temp_tembak->SD0));

				$sheet->setCellValue('I' . $row, $this->safe($v->temp_tembak->E1));
				$sheet->setCellValue('J' . $row, $this->safe($v->temp_tembak->N1));
				$sheet->setCellValue('K' . $row, $this->safe($v->temp_tembak->Z1));
				$sheet->setCellValue('L' . $row, $this->safe($v->temp_tembak->HA1));
				$sheet->setCellValue('M' . $row, $this->safe($v->temp_tembak->VA1));
				$sheet->setCellValue('N' . $row, $this->safe($v->temp_tembak->SD1));

				$sheet->setCellValue('O' . $row, $this->safe($v->temp_tembak->DE));
				$sheet->setCellValue('P' . $row, $this->safe($v->temp_tembak->DN));
				$sheet->setCellValue('Q' . $row, $this->safe($v->temp_tembak->DZ));

				$sheet->setCellValue('R' . $row, $this->safe($v->temp_tembak->linear));
				$sheet->setCellValue('S' . $row, $this->safe($v->temp_tembak->arah_pergeseran));
			}

			$row++;
		}

		$temp_dir = APPPATH . 'tmp/';
		if (!is_dir($temp_dir)) {
			mkdir($temp_dir, 0777, true);
		}
		$temp_file = tempnam($temp_dir, 'excel_');
		$write = PHPExcel_IOFactory::createWriter($excel, 'Excel2007');
		$write->save($temp_file);

		header('Content-Description: File Transfer');
		header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

		header('Content-Disposition: attachment; filename="Hasil Penembakan RTS ' . $judul2 . ' PT MIP ' . $tgl . '.xlsx"');
		header('Content-Transfer-Encoding: binary');
		header('Expires: 0');
		header('Cache-Control: must-revalidate');
		header('Pragma: public');
		header('Content-Length: ' . filesize($temp_file));
		@ob_end_clean();
		flush();
		readfile($temp_file);
		unlink($temp_file);
		exit;
	}

	function arah8ID($DE, $DN)
	{
		$deg = rad2deg(atan2($DE, $DN));
		$deg = ($deg + 360) % 360;
		$dirs = [
			"Utara",
			"Timur Laut",
			"Timur",
			"Tenggara",
			"Selatan",
			"Barat Daya",
			"Barat",
			"Barat Laut"
		];
		$index = intval(($deg + 22.5) / 45) % 8;
		return [
			"bearing" => $deg,
			"arah_id" => $dirs[$index]
		];
	}

	public function index()
	{
		if ($this->session->userdata('logged_in')) {
			if (!$this->session->userdata('temp_kontrol')) {
				$temp_kontrol = $this->db->order_by('datetime', 'desc')->limit(1)->get('log_kontrol')->row();
				$this->session->set_userdata('temp_kontrol', $temp_kontrol);
			}
			$this->load->library('googlemaps');
			$ktg = $this->db->where('view', '1')->order_by('id_katlogger', 'desc')->get('kategori_logger')->result_array();

			$data['ktg_all'] = $this->db->where('view', '1')->get('kategori_logger')->result_array();
			$log_data = $this->db->order_by('datetime', 'desc')->get('log_kontrol')->result_array();
			$data['log_data'] = $log_data;
			if ($this->session->userdata('temp_kontrol')) {
				$idlog = $this->session->userdata('temp_kontrol')->id_log;
			} else {
				$idlog = '';
			}
			$site = $this->session->userdata('temp_kontrol')->site;
			$selected_datetime = $this->session->userdata('temp_kontrol')->datetime ?? date('Y-m-d H:i:s');
			$selected_date = date('Y-m-d', strtotime($selected_datetime));
			$day_start = $selected_date . ' 00:00:00';
			$day_end = $selected_date . ' 23:59:59';
			$marker = [];

			$log_first = $this->db->where('site', $site)->where('r0', '1')->get('log_kontrol')->row()->id_log;
			foreach ($ktg  as $key => $kat) {
				$tabel = $kat['temp_data'];
				$data_logger = $this->db->join('t_lokasi', 't_logger.lokasi_logger = t_lokasi.idlokasi')->where('kategori_log', $kat['id_katlogger'])->order_by('id_logger')->get('t_logger')->result_array();

				foreach ($data_logger as $k => $log) {
					$id_logger = $log['id_logger'];
					$temp_data = $this->db->where('code_logger', $id_logger)->get($tabel)->row();
					if ($tabel == 'temp_rts') {
						$temp_prisma = $this->db->join('temp_prisma', 'temp_prisma.id_prisma = t_prisma.id_prisma')->where('id_logger', $id_logger)->get('t_prisma')->result_array();
						foreach ($temp_prisma as $ke => $vl) {
							$cek_tembak = $this->db
								->where('id_kontrol', $idlog)
								->where('code_logger', $id_logger)
								->where('sensor1', $vl['id_prisma'])
								->get('rts')
								->row();
							$first_data = $this->db
								->where('id_kontrol', $log_first)
								->where('code_logger', $id_logger)
								->where('sensor1', $vl['id_prisma'])
								->order_by('waktu', 'asc')
								->get('rts')
								->row();
							if ($cek_tembak) {
								$N1 = $cek_tembak->sensor8;
								$E1 = $cek_tembak->sensor9;
								$Z1 = $cek_tembak->sensor10;
								if ($site == 'ccp') {
									list($newE, $newN) = $this->rotateEN($E1, $N1, 114);
									$N1 = $newN;
									$E1 = $newE;
								}
								$nama_prisma = $cek_tembak->sensor3;

								if ($first_data) {

									$N0 = $first_data->sensor8;
									$E0 = $first_data->sensor9;
									$Z0 = $first_data->sensor10;
									if ($site == 'ccp') {
										list($newE0, $newN0) = $this->rotateEN($E0, $N0, 114);
										$N0 = $newN0;
										$E0 = $newE0;
									}
									$HA0 = $first_data->sensor5;
									$VA0 = $first_data->sensor6;
									$SD0 = $first_data->sensor7;
									if ($N1 != '000,00,00' and $E1 != '000,00,00' and $Z1 != '000,00,00') {
										$DN =  $N1 - $N0;
										$DE = $E1 - $E0;
										$DZ = $Z1 - $Z0;
										$linier = sqrt(pow(($E0 - $E1), 2) + pow(($N0 - $N1), 2));
									} else {
										$DN =  0;
										$DE = 0;
										$DZ = 0;
										$linier = 0;
									}
								} else {
									$N0 = 0;
									$E0 = 0;
									$Z0 = 0;

									$HA0 = '000,00,00';
									$VA0 = '000,00,00';
									$SD0 = '000,00,00';

									$DN = 0;
									$DE = 0;
									$DZ = 0;
									$linier = 0;
								}

								$HA1 = $cek_tembak->sensor5;
								$VA1 = $cek_tembak->sensor6;
								$SD1 = $cek_tembak->sensor7;

								if ($N1 != '000,00,00' and $E1 != '000,00,00' and $Z1 != '000,00,00') {
									$latlong = json_decode(utm2ll($E1, $N1, 50, true))->attr;
									$deg  = 114;
									$latlong_first = json_decode(utm2ll($E0, $N0, 50, true))->attr;
									$newLat = $latlong_first->lat;
									$newLng = $latlong_first->lon;
									$newLat1 = $latlong->lat;
									$newLng1 = $latlong->lon;
									$marker[] = [
										'latitude_new' => $newLat1,
										'longitude_new' => $newLng1,
										'latitude_conv' => $newLat,
										'longitude_conv' => $newLng,
										'latitude_r0' => $latlong_first->lat,
										'longitude_r0' => $latlong_first->lon,
										'deltaX' => number_format($DN, 6, '.', ''),
										'deltaY' => number_format($DE, 6, '.', ''),
										'deltaZ' => number_format($DZ, 6, '.', ''),
										'title' => $nama_prisma,
										'icon' => base_url() . 'pin_marker/prisma_marker.png',
										'icon_scaledSize' => '33,33',
										'sdis' => $SD1
									];
								} else {
									$latlong = 0;
									$N0 = $first_data->sensor8;
									$E0 = $first_data->sensor9;
									$latlong_first = json_decode(utm2ll($E0, $N0, 48, false))->attr;

									$marker[] = [
										'latitude_new' => 0,
										'longitude_new' => 0,
										'latitude_r0' => $latlong_first->lat,
										'longitude_r0' => $latlong_first->lon,
										'deltaX' => number_format($DN, 3, '.', ''),
										'deltaY' => number_format($DE, 3, '.', ''),
										'deltaZ' => number_format($DZ, 3, '.', ''),
										'title' => $nama_prisma,
										'icon' => base_url() . 'pin_marker/prisma_marker.png',
										'icon_scaledSize' => '33,33',
										'sdis' => $SD1
									];
								}
								$arah = '-';
								if ($linier > 0) {
									$arah = $this->arah8ID($DE, $DN)['bearing'] . ' (' . $this->arah8ID($DE, $DN)['arah_id'] . ')';
								}

								$temp_prisma[$ke]['temp_tembak'] = [
									'nama_prisma' => $nama_prisma,
									'N1' => $N1,
									'E1' => $E1,
									'Z1' => $Z1,
									'HA1' => $HA1,
									'VA1' => $VA1,
									'SD1' => $SD1,
									'N0' => $N0,
									'E0' => $E0,
									'Z0' => $Z0,
									'HA0' => $HA0,
									'VA0' => $VA0,
									'SD0' => $SD0,
									'latlong' => $latlong,
									'DN' => number_format($DN, 3, '.', ''),
									'DE' => number_format($DE, 3, '.', ''),
									'DZ' => number_format($DZ, 3, '.', ''),
									'linear' => $linier,
									'arah_pergeseran' => $arah
								];

								$baseE = $this->nfloat($E0);
								$baseN = $this->nfloat($N0);
								$baseZ = $this->nfloat($Z0);
								$base_ok = !(abs($baseE) < 1e-12 && abs($baseN) < 1e-12 && abs($baseZ) < 1e-12);

								$daily = [
									'count' => 0,
									'first_time' => null,
									'last_time' => null,
									'pergeseran_mm' => null,
									'kecepatan_mmd' => null,
									'status_pergeseran' => null,
									'status_kecepatan' => null,
									'series' => []
								];

								if ($base_ok) {
									$id_logs = $this->db
										->select('id_log')
										->where('site', $site)
										->where('datetime >=', $day_start)
										->where('datetime <=', $day_end)
										->get('log_kontrol')
										->result_array();
									$id_logs = array_map(static function ($row) {
										return $row['id_log'];
									}, $id_logs);

									$rows = [];
									if (!empty($id_logs)) {
										$rows = $this->db
											->select('waktu,sensor8,sensor9,sensor10')
											->where('code_logger', $id_logger)
											->where('sensor1', $vl['id_prisma'])
											->where_in('id_kontrol', $id_logs)
											->where('id_kontrol !=', '')
											->where('waktu >=', $day_start)
											->where('waktu <=', $day_end)
											->order_by('waktu', 'asc')
											->get('rts')
											->result();
									}
									$first_lin = null;
									$last_lin = null;
									$first_time = null;
									$last_time = null;
									$series = [];

									foreach ($rows as $rw) {
										$e1 = $this->nfloat($rw->sensor9);
										$n1 = $this->nfloat($rw->sensor8);
										$z1 = $this->nfloat($rw->sensor10);
										if (abs($e1) < 1e-12 && abs($n1) < 1e-12 && abs($z1) < 1e-12) {
											continue;
										}

										if ($site == 'ccp') {
											list($e1r, $n1r) = $this->rotateEN($e1, $n1, 114);
											$e1 = $e1r;
											$n1 = $n1r;
										}

										$lin_m = sqrt(pow(($e1 - $baseE), 2) + pow(($n1 - $baseN), 2));

										if ($first_lin === null) {
											$first_lin = $lin_m;
											$first_time = $rw->waktu;
										}
										$last_lin = $lin_m;
										$last_time = $rw->waktu;
										$series[] = [
											't' => $rw->waktu,
											'mm' => $lin_m * 1000.0
										];
									}

									if ($first_lin !== null && $last_lin !== null) {
										$daily['count'] = count($rows);
										$daily['first_time'] = $first_time;
										$daily['last_time'] = $last_time;

										$pergeseran_mm = $last_lin * 1000.0;
										$delta_mm = abs($last_lin - $first_lin) * 1000.0;

										$kecepatan_mmd = $delta_mm;

										$daily['pergeseran_mm'] = $pergeseran_mm;
										$daily['kecepatan_mmd'] = $kecepatan_mmd;
										$daily['status_pergeseran'] = $this->status_pergeseran($pergeseran_mm, $site);
										$daily['status_kecepatan'] = $this->status_kecepatan($kecepatan_mmd, $site);
										$daily['series'] = $series;
									}
								}

								$temp_prisma[$ke]['daily'] = $daily;
							} else {
								$temp_prisma[$ke]['temp_tembak'] = [];
								$temp_prisma[$ke]['daily'] = [
									'count' => 0,
									'first_time' => null,
									'last_time' => null,
									'pergeseran_mm' => null,
									'kecepatan_mmd' => null,
									'status_pergeseran' => null,
									'status_kecepatan' => null,
									'series' => []
								];
							}
						}
						$awal = date('Y-m-d H:i', (mktime(date('H') - 1)));
						if ($temp_data->waktu >= $awal) {
							$color = "green";
							$status_logger = "Koneksi Terhubung";
						} else {
							$color = "dark";
							$status_logger = "Koneksi Terputus";
						}

						if ($temp_data->sensor17 == '1') {
							$sdcard = 'OK';
						} else {
							$sdcard = 'Bermasalah';
						}
						if ($temp_data->sensor14 == '1' and $temp_data->waktu >= $awal) {
							if ($temp_data->sensor16 == '1') {
								$status_rts = "Connected - Running";
							} else {
								$status_rts = "Connected - Standby";
							}
						} else {
							$status_rts = "Disconnected";
						}
						$data_dashboard = [
							'status' => $status_rts,
							'power_rts' => $temp_data->sensor23,
							'baterai' => $temp_data->sensor21,
							'humidity' => $temp_data->sensor20,
							'temperature' => $temp_data->sensor22,
						];
						$ktg[$key]['logger'][$k] = [
							'id_logger' => $id_logger,
							'nama_lokasi' => $log['nama_lokasi'],
							'waktu' => $temp_data->waktu,
							'color' => $color,
							'status_logger' => $status_logger,
							'status_sd' => $sdcard,
							'temp_prisma' => $temp_prisma,
							'data_dashboard' => $data_dashboard
						];

						$this->session->set_userdata('temp_prisma', $temp_prisma);
					} else {
						$data_logger = $this->db->join('t_informasi', 't_informasi.logger_id = t_logger.id_logger')->join('t_lokasi', 't_logger.lokasi_logger = t_lokasi.idlokasi')->where('kategori_log', $kat['id_katlogger'])->get('t_logger')->result_array();

						foreach ($data_logger as $k => $log) {

							$id_logger = $log['id_logger'];
							$temp_data = $this->db->where('code_logger', $id_logger)->get($tabel)->row();

							$awal = date('Y-m-d H:i', (mktime(date('H') - 1)));
							if ($temp_data->waktu >= $awal) {
								$color = "green";
								$status_logger = "Koneksi Terhubung";
							} else {
								$color = "dark";
								$status_logger = "Koneksi Terputus";
							}

							if ($temp_data->sensor13 == '1') {
								$sdcard = 'OK';
							} else {
								$sdcard = 'Bermasalah';
							}
							$param = $this->db->where('logger_id', $id_logger)->get('parameter_sensor')->result_array();


							foreach ($param as $ky => $val) {
								$get = 'tabel=' . $kat['tabel'] . '&id_param=' . $val['id_param'];
								$kolom = $val['kolom_sensor'];

								$param[$ky]['nilai'] = $temp_data->$kolom;

								$param[$ky]['link'] = 'masterdata/set_sensordash?' . $get;
							}
							$ktg[$key]['logger'][$k] = [
								'id_logger' => $id_logger,
								'nama_lokasi' => $log['nama_lokasi'],
								'waktu' => $temp_data->waktu,
								'color' => $color,
								'status_logger' => $status_logger,
								'status_sd' => $sdcard,
								'param' => $param
							];
						}
					}
				}
			}
			$data['marker'] = $marker;
			$data['data_konten'] = $ktg;

			$data['konten'] = 'konten/back/v_demo';
			$this->load->view('template_admin/site', $data);
		} else {
			redirect('login');
		}
	}
}
