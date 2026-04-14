
<?php if (!defined('BASEPATH')) exit('No direct script access allowed');


class Adr extends CI_Controller
{

	function __construct()
	{
		parent::__construct();
		$this->load->library('csvimport');
		$this->load->model('m_awlr');
		$this->load->library('PhpMQTT');
		if (!$this->session->userdata('logged_in')) {
			redirect('login');
		}
	}

	public function mulai_config()
	{
		$ip = $this->session->userdata('device_id');
		$kode = $this->input->post('kode_akses');
		if ($kode === 'DemoADR') {
			$data= [
				'status_operation'=>$ip
			];
			$this->db->update('set_tempkontrol',$data);
			redirect('adr/daftar_prisma');
		} else {
			redirect('adr/daftar_prisma');
		}
	}

	public function selesai_config()
	{
		$data= [
			'status_operation'=>'0'
		];
		$this->db->update('set_tempkontrol',$data);
		
		redirect('adr/daftar_prisma');
	}

	function daftar_prisma () {
		$data = array();
		$status_kontrol = $this->db->where('id_logger','30002')->get('set_tempkontrol')->row();
		$data_prisma = $this->db->join('temp_prisma','temp_prisma.id_prisma = t_prisma.id_prisma')->where('id_logger','30002')->get('t_prisma')->result_array();

		$temp_rts =$this->db->where('code_logger','30002')->get('temp_rts')->row();
		$data_rts = $this->db->where('logger_id','30002')->get('parameter_sensor')->result_array();
		$rts_data = [];
		foreach($data_rts as $key=> $vl){
			$kolom = $vl['kolom_sensor'];
			$data_rts[$key]['nilai'] = $temp_rts->$kolom;
			$rts_data[$vl['nama_parameter']] = [
				'nilai' =>$temp_rts->$kolom,
				'satuan' =>$vl['satuan'],
			];
		}
		$lokasi =$this->db->join('t_informasi','t_informasi.logger_id = t_logger.id_logger')->join('t_lokasi','t_lokasi.idlokasi = t_logger.lokasi_logger')->get('t_logger')->row();
		$awal=date('Y-m-d H:i', (mktime(date('H') - 1)));
		if($temp_rts->waktu >= $awal){
			$status=true;
		}else{
			$status=false;
		}
		$data['info_logger']= $lokasi;
		$data['status_logger']= $status;
		$data['data_rts'] = $rts_data;
		$data['status_kontrol'] = $status_kontrol;

		$slot = array();

		for ($i = 1; $i <= 50; $i++) {
			$id_prisma = 'P' . $i;
			$prisma_cek = $this->db->where('id_prisma',$id_prisma)->get('t_prisma')->row_array();
			if($prisma_cek){
				$slot[] = $prisma_cek;
			}else{
				$slot[] = array(
					'id' => $i,
					'id_prisma' => 'P' . $i,
					'id_logger' => '',            // default kosong
					'nama_prisma' => '',          // default kosong
					'status_controller' => 'sensor9', // default sensor9
					'target_height' => '',
					'HA' => '',
					'VA' => '',
					'SlopDis' => ''
				);
			}
		}
		$data['list_prisma'] = $slot;
		$data['konten'] = 'konten/back/adr/prisma_list';
		$this->load->view('template_admin/site', $data);
	}

	public function update_prisma()
	{
		$slot_id       = $this->input->post('slot_id');
		$nama_prisma   = $this->input->post('nama_prisma');
		$target_height = $this->input->post('target_height');

		// Validasi minimal
		if(!$slot_id || !$nama_prisma){
			echo json_encode([
				'status'  => false,
				'message' => 'Slot ID dan Nama Prisma wajib diisi'
			]);
			return;
		}

		$data = [
			'id_prisma'        => 'P'.$slot_id,
			'nama_prisma'      => $nama_prisma,
			'status_controller'=> 'sensor9',
			'target_height'    => $target_height ? $target_height : 0
		];

		$this->db->where('id', $slot_id);
		$update = $this->db->update('t_prisma', $data);

		$data_mqtt = [
			"set_30002" => [
				"command" => "set_rts",
				"recordTarget" => [
					"slot"   => (int) $slot_id,
					"name"   => $nama_prisma,
					"targetHigh" => $target_height
				]
			]
		];

		$server   = 'mqtt.beacontelemetry.com';
		$port     = 8883;
		$username = 'userlog';
		$password = 'b34c0n';
		$client_id = 'bemqtt-adr';
		$ca = "/etc/ssl/certs/ca-bundle.crt";

		$mqtt = new phpMQTT($server, $port, $client_id, $ca);

		if ($mqtt->connect(true, NULL, $username, $password)) {

			$mqtt->publish(
				'ADR_Tambang_Kaltara',
				json_encode($data_mqtt),
				1,                // QoS = 1 recommended
				false             // retain = false
			);

			$mqtt->close();

		} else {
			echo "MQTT Connection Timeout!";
		}
		if($update){
			echo json_encode([
				'status'  => true,
				'message' => 'Prisma berhasil diperbarui'
			]);
		} else {
			echo json_encode([
				'status'  => false,
				'message' => 'Gagal memperbarui prisma. Cek log server.'
			]);
		}
	}

	function go_target (){
		$slot_id       = $this->input->post('slot_id');
		$data_mqtt = [
			"set_30002" => [
				"command" => "set_rts",
				"turning_target" => $slot_id
			]
		];
		$server   = 'mqtt.beacontelemetry.com';
		$port     = 8883;
		$username = 'userlog';
		$password = 'b34c0n';
		$client_id = 'bemqtt-adr';
		$ca = "/etc/ssl/certs/ca-bundle.crt";

		$mqtt = new phpMQTT($server, $port, $client_id, $ca);

		if ($mqtt->connect(true, NULL, $username, $password)) {

			$mqtt->publish(
				'ADR_Tambang_Kaltara',
				json_encode($data_mqtt),
				1,                // QoS = 1 recommended
				false             // retain = false
			);

			$mqtt->close();

		} else {
			echo "MQTT Connection Timeout!";
		}

		echo json_encode([
			'status'  => true,
			'message' => 'Start'
		]);

	}

	function auto_search (){
		$data_mqtt = [
			"set_30002" => [
				"command" => "set_rts",
				"auto_search"=>true
			]
		];
		$server   = 'mqtt.beacontelemetry.com';
		$port     = 8883;
		$username = 'userlog';
		$password = 'b34c0n';
		$client_id = 'bemqtt-adr';
		$ca = "/etc/ssl/certs/ca-bundle.crt";

		$mqtt = new phpMQTT($server, $port, $client_id, $ca);

		if ($mqtt->connect(true, NULL, $username, $password)) {

			$mqtt->publish(
				'ADR_Tambang_Kaltara',
				json_encode($data_mqtt),
				1,                // QoS = 1 recommended
				false             // retain = false
			);

			$mqtt->close();

		} else {
			echo "MQTT Connection Timeout!";
		}
		echo json_encode([
			'status'  => true,
			'message' => 'Start'
		]);

	}

	public function input_prisma()
	{
		$slot_id       = $this->input->post('slot_id');
		$nama_prisma   = $this->input->post('nama_prisma');
		$target_height = $this->input->post('target_height');

		// ========== VALIDASI WAJIB ==========
		if (!$slot_id || !$nama_prisma) {
			echo json_encode([
				'status'  => false,
				'message' => 'Slot ID dan Nama Prisma harus diisi.'
			]);
			return;
		}

		$this->db->select_max('id');
		$q = $this->db->get('t_prisma')->row();

		$new_id = ($q && $q->id) ? $q->id + 1 : 1;

		// ========== 1. INSERT KE t_prisma ==========
		$data = [
			'id'              => $new_id,
			'id_logger'        => '30002',
			'id_prisma'        => 'P'.$slot_id,
			'nama_prisma'      => $nama_prisma,
			'status_controller'=> 'sensor9',
			'target_height'    => $target_height
		];
		$this->db->insert('t_prisma', $data);

		// ========== 2. INSERT KE temp_prisma ==========
		$data_temp = [
			'id_prisma' => 'P'.$slot_id,
			'waktu'     => '-',
			'N1'        => '0',
			'E1'        => '0',
			'Z1'        => '0',
			'N0'        => '0',
			'E0'        => '0',
			'Z0'        => '0',
			'status_get'=> '1'
		];
		$this->db->insert('temp_prisma', $data_temp);

		// ========== 3. INSERT PARAMETER ==========
		$param_north = [
			'id_prisma'     => 'P'.$slot_id,
			'nama_parameter'=> 'Northing_Y',
			'kolom_sensor'  => 'sensor8',
			'analisa'       => '1',
			'tipe_graf'     => 'spline',
			'icon_sensor'   => 'northing',
		];
		$this->db->insert('parameter_prisma', $param_north);

		$param_east = [
			'id_prisma'     => 'P'.$slot_id,
			'nama_parameter'=> 'Easting_X',
			'kolom_sensor'  => 'sensor9',
			'analisa'       => '1',
			'tipe_graf'     => 'spline',
			'icon_sensor'   => 'easting',
		];
		$this->db->insert('parameter_prisma', $param_east);

		$param_elev = [
			'id_prisma'     => 'P'.$slot_id,
			'nama_parameter'=> 'Elevation',
			'kolom_sensor'  => 'sensor10',
			'analisa'       => '1',
			'tipe_graf'     => 'spline',
			'icon_sensor'   => 'elevation_z',
		];
		$this->db->insert('parameter_prisma', $param_elev);

		// ========== 4. MQTT PAYLOAD ==========
		$data_mqtt = [
			"set_30002" => [
				"command" => "set_rts",
				"recordTarget" => [
					"slot"       => (int)$slot_id,
					"name"       => $nama_prisma,
					"targetHigh" => $target_height
				]
			]
		];

		// ========== 5. MQTT PUBLISH ==========
		$server    = 'mqtt.beacontelemetry.com';
		$port      = 8883;
		$username  = 'userlog';
		$password  = 'b34c0n';
		$client_id = 'bemqtt-adr';
		$ca        = "/etc/ssl/certs/ca-bundle.crt";

		$mqtt = new phpMQTT($server, $port, $client_id, $ca);

		if ($mqtt->connect(true, NULL, $username, $password)) {

			$mqtt->publish(
				'ADR_Tambang_Kaltara',
				json_encode($data_mqtt),
				1,
				false
			);

			$mqtt->close();

		} else {
			echo json_encode([
				'status'  => false,
				'message' => 'MQTT Connection Timeout!'
			]);
			return;
		}

		echo json_encode([
			'status'  => true,
			'message' => 'Prisma berhasil diset, menunggu respon perangkat...'
		]);
	}


	public function prism_set()
	{
		$nama_prisma = $this->input->post('nama_prisma');
		$HA          = $this->input->post('HA');
		$VA          = $this->input->post('VA');

		// Validasi input
		if(!$nama_prisma){
			echo json_encode([
				'status'  => false,
				'message' => 'Nama prisma wajib dikirim'
			]);
			return;
		}

		if($HA === null || $VA === null){
			echo json_encode([
				'status'  => false,
				'message' => 'Parameter HA dan VA wajib dikirim'
			]);
			return;
		}

		// Cek apakah prisma sudah ada
		$prisma = $this->db
			->where('nama_prisma', $nama_prisma)
			->get('t_prisma')
			->row_array();

		if(!$prisma){
			echo json_encode([
				'status'  => false,
				'message' => 'Prisma tidak ditemukan di database'
			]);
			return;
		}

		// Data Update
		$data = [
			'HA' => $HA,
			'VA' => $VA
		];

		$this->db->where('nama_prisma', $nama_prisma);
		$update = $this->db->update('t_prisma', $data);

		if($update){
			echo json_encode([
				'status'  => true,
				'message' => 'Data HA dan VA berhasil diperbarui'
			]);
		} else {
			echo json_encode([
				'status'  => false,
				'message' => 'Update gagal, silakan cek log server'
			]);
		}
	}


	function set_sensordash()
	{
		$tabel = $this->input->get('tabel');
		$id_prisma = $this->input->get('id_prisma');

		$id_param = $this->db->where('id_prisma',$id_prisma)->get('parameter_prisma')->row();

		$session = [
			'id_prisma'=>$id_prisma,

			'idlogger' => '30002',
			'idparameter' => $id_param->id_param,
			'nama_parameter' => $id_param->nama_parameter,
			'kolom' => $id_param->kolom_sensor,
			'satuan' => $id_param->satuan,
			'tipe_grafik' => $id_param->tipe_graf,
		];
		$this->session->set_userdata($session);
		$querylogger = $this->db->query('select * from t_logger INNER JOIN t_lokasi ON t_logger.lokasi_logger=t_lokasi.idlokasi where id_logger=30002;')->row();

		$lokasilog = $querylogger->nama_lokasi;
		$this->session->set_userdata('namalokasi', $lokasilog);		
		$this->session->set_userdata('tabel', $tabel);

		$tgl = date('Y-m-d');
		$this->session->set_userdata('pada', $tgl);
		$this->session->set_userdata('data', 'hari');
		$this->session->set_userdata('tanggal', $tgl);

		$this->session->set_userdata('controller', 'adr');


		redirect('adr/analisa');
	}

	public function config_adr()
	{
		$id_logger = '30002';
		$data = [
			'job_name'     => $this->input->post('job_name'),
			'prisma_cons' => $this->input->post('prisma_const'),
			'ts_high'      => $this->input->post('ts_high'),
			'coor_x'       => $this->input->post('coor_x'),
			'coor_y'       => $this->input->post('coor_y'),
			'coor_z'       => $this->input->post('coor_z'),
			'step_record'  => $this->input->post('step_record'),
			'retries'      => $this->input->post('retries'),
			'cycle_time'   => $this->input->post('cycle_time')
		];

		$this->db->where('id_logger', $id_logger)->update('config_adr', $data);

		$payload = [
			"set_{$id_logger}" => [
				"command"     => "set_rts",
				"jobName"     => $data['job_name'],
				"prismConst"  => $data['prisma_cons'],
				"tsHigh"      => $data['ts_high'],
				"locCoor"     => [
					$data['coor_x'],
					$data['coor_y'],
					$data['coor_z']
				],
				"stepRecord"  => (int) $data['step_record'],
				"retries"     => (int) $data['retries'],
				"cycleTime"   => (int) $data['cycle_time']
			]
		];

		$server   = 'mqtt.beacontelemetry.com';
		$port     = 8883;
		$username = 'userlog';
		$password = 'b34c0n';
		$client_id = 'bemqtt-' . $this->input->post('id_alat');
		$ca = "/etc/ssl/certs/ca-bundle.crt";

		$mqtt = new phpMQTT($server, $port, $client_id, $ca);

		if ($mqtt->connect(true, NULL, $username, $password)) {

			$mqtt->publish(
				'ADR_Tambang_Kaltara',
				json_encode($payload),
				1,                // QoS = 1 recommended
				false             // retain = false
			);

			$mqtt->close();

		} else {
			echo "MQTT Connection Timeout!";
		}

		redirect('adr/kontrol');
	}
	function set_prisma()
	{
		$id_prisma = $this->input->post('id_prisma');
		$id_param = $this->db->where('id_prisma',$id_prisma)->get('parameter_prisma')->row();

		$session = [
			'id_prisma'=>$id_prisma,

			'idlogger' => '30002',
			'idparameter' => $id_param->id_param,
			'nama_parameter' => $id_param->nama_parameter,
			'kolom' => $id_param->kolom_sensor,
			'satuan' => $id_param->satuan,
			'tipe_grafik' => $id_param->tipe_graf,
		];
		$this->session->set_userdata($session);
		redirect('adr/analisa');
	}

	function settgl()
	{
		$tgl = str_replace('/', '-', $this->input->post('tgl'));
		$this->session->set_userdata('tanggal', $tgl);
		$this->session->set_userdata('pada', $tgl);
		redirect('adr/analisa_logger');
	}

	function set_parameter()
	{
		$idparam = $this->input->post('id_param');
		$id_param = $this->db->where('id_param',$idparam)->get('parameter_prisma')->row();

		$session = [
			'id_prisma'=>$id_param->id_prisma,

			'idlogger' => '30002',
			'idparameter' => $id_param->id_param,
			'nama_parameter' => $id_param->nama_parameter,
			'kolom' => $id_param->kolom_sensor,
			'satuan' => $id_param->satuan,
			'tipe_grafik' => $id_param->tipe_graf,
		];
		$this->session->set_userdata($session);
		redirect('adr/analisa');
	}

	function setrange()
	{
		$this->session->set_userdata('dari', $this->input->post('dari'));
		$this->session->set_userdata('sampai', $this->input->post('sampai'));
		redirect('adr/analisa');
	}

	function kontrol()
	{
		if ($this->session->userdata('logged_in')) {
			$data = array();
			$status_kontrol = $this->db->where('id_logger','30002')->get('set_tempkontrol')->row();
			$data_prisma = $this->db->join('temp_prisma','temp_prisma.id_prisma = t_prisma.id_prisma')->where('id_logger','30002')->get('t_prisma')->result_array();
			$log_kontrol = $this->db->order_by('datetime','desc')->limit(10)->get('log_kontrol')->result_array();
			foreach($log_kontrol as $k => $lg) {
				$data_kirim = $this->db->where('id_kontrol',$lg['id_log'])->get('rts')->result_array();
				$dt_send = [];
				foreach($data_kirim as $dk=>$v){
					if($v['sensor8'] != 0 and $v['sensor9'] != 0 and $v['sensor10'] != 0){
						$sts_get = 'Success';
					}else{
						$sts_get = 'Failed';
					}
					$dt_send[] = [
						'id_prisma'=>$v['sensor1'],
						'E'=>$v['sensor8'],
						'N'=>$v['sensor9'],
						'Z'=>$v['sensor10'],
						'status'=>$sts_get,
					];
				}
				$log_kontrol[$k]['data_kirim'] = $dt_send;
			}
			$temp_rts =$this->db->where('code_logger','30002')->get('temp_rts')->row();
			$data_rts = $this->db->where('logger_id','30002')->get('parameter_sensor')->result_array();
			$rts_data = [];
			foreach($data_rts as $key=> $vl){
				$kolom = $vl['kolom_sensor'];
				$data_rts[$key]['nilai'] = $temp_rts->$kolom;
				$rts_data[$vl['nama_parameter']] = [
					'nilai' =>$temp_rts->$kolom,
					'satuan' =>$vl['satuan'],
				];
			}
			$lokasi =$this->db->join('t_informasi','t_informasi.logger_id = t_logger.id_logger')->join('t_lokasi','t_lokasi.idlokasi = t_logger.lokasi_logger')->get('t_logger')->row();
			$awal=date('Y-m-d H:i', (mktime(date('H') - 1)));
			if($temp_rts->waktu >= $awal){
				$status=true;
			}else{
				$status=false;
			}
			$data['info_logger']= $lokasi;
			$data['status_logger']= $status;
			$data['data_rts'] = $rts_data;
			$data['status_kontrol'] = $status_kontrol;
			$data['log_kontrol'] = $log_kontrol;
			$data['data_prisma'] = $data_prisma;
			$data['waktu'] = $temp_rts->waktu;
			$data['konten'] = 'konten/back/adr/kontrol_adr';
			$dt_schedule = $this->db->select('days')->group_by('days')->get('scheduling_task')->result_array();
			$data['adr'] = $this->db->get('config_adr')->row_array();
			$schedule = $this->db->get('scheduling_task')->result_array();
			foreach($dt_schedule as $x => $vl){
				$dt_schedule[$x]['status'] = false;
				foreach($schedule as $sc){
					if($sc['days'] == $vl['days']){
						if($sc['status'] == '1'){
							$dt_schedule[$x]['status'] = true;
						}
						$dt_schedule[$x]['sc'][] = $sc;
					}
				}
			}
			$total_prisma = $this->db->get('t_prisma')->result_array();
			$data['jumlah_prisma'] = count($total_prisma);
			$status_jadwal = false;
			$data['schedule'] = $dt_schedule;
			$data['schedule_all'] = $schedule;
			$this->load->view('template_admin/site', $data);
		} else {
			redirect('login');
		}
	}

	function analisa()
	{
		if ($this->session->userdata('logged_in')) {

			$data = array();
			$data_tabel = array();
			$prs = [];
			$prs2 = [];
			$range = array();
			$data_first= [];
			$data_last= [];
			$site = $this->session->userdata('temp_kontrol')->site;
			$first_run = $this->db->where('site',$site)->where('r0','1')->get('log_kontrol')->row();

			####################################################################################### HARI ##################
			if ($this->session->userdata('data') == 'hari') {
				$sensor = $this->session->userdata('nama_parameter');

				$kolom = $this->session->userdata('kolom');

				$select = $kolom .' as '. $sensor;
				$satuan = $this->session->userdata('satuan');

				$awal= $this->session->userdata('dari');
				$akhir = $this->session->userdata('sampai');
				if($site == 'viewpoint') {
					$akhir = '2025-11-20 14:46:00';
				}
				if(!$awal){
					$query_data = $this->db->query("SELECT waktu, sensor8,sensor9,sensor10,MINUTE(waktu) as menit,HOUR(waktu) as jam,DAY(waktu) as hari,MONTH(waktu) as bulan,YEAR(waktu) as tahun," . $select . " FROM " . $this->session->userdata('tabel') . " where sensor1='" . $this->session->userdata('id_prisma') . "' order by waktu asc;")->result();
				}else{
					$query_data = $this->db->query("SELECT waktu, sensor8,sensor9,sensor10,MINUTE(waktu) as menit,HOUR(waktu) as jam,DAY(waktu) as hari,MONTH(waktu) as bulan,YEAR(waktu) as tahun," . $select . " FROM " . $this->session->userdata('tabel') . " where sensor1='" . $this->session->userdata('id_prisma') . "' and waktu >= '".$first_run->datetime."' and waktu <= '".$akhir."' order by waktu asc;")->result();
				}
				foreach ($query_data as $datalog) {
					if($datalog->$sensor > 0){
						$data[] = "[ Date.UTC(" . $datalog->tahun . "," . $datalog->bulan . "-1," . $datalog->hari . "," . $datalog->jam . ",".$datalog->menit.")," . number_format($datalog->$sensor, 3,'.','') . "]";
						$data_tabel[] = array(
							'waktu' => date('Y-m-d H:i:s', strtotime($datalog->waktu)),
							'dta' => number_format($datalog->$sensor, 3,'.',''),
						);
					}

				}
				if($query_data){
					$last_data = $this->db->query("SELECT waktu, sensor8,sensor9,sensor10,MINUTE(waktu) as menit,HOUR(waktu) as jam,DAY(waktu) as hari,MONTH(waktu) as bulan,YEAR(waktu) as tahun," . $select . " FROM " . $this->session->userdata('tabel') . " where sensor1='" . $this->session->userdata('id_prisma') . "' and id_kontrol = '".$first_run->id_log."' order by waktu asc;")->result();
					$data_first = $last_data[0];
					$array_key_last = array_key_last($query_data);
					$data_last = $query_data[$array_key_last];
					if(!$this->session->userdata('dari')){
						$this->session->set_userdata('dari',$data_first->waktu);
						$this->session->set_userdata('sampai',$data_last->waktu);	
					}
				}

				$dataAnalisa = array(
					'idLogger' => $this->session->userdata('idlogger'),
					'namaSensor' => $sensor,
					'satuan' => $satuan,
					'tipe_grafik' => $this->session->userdata('tipe_grafik'),
					'data' => $data,
					'data_tabel' => $data_tabel,
					'nosensor' => $kolom,
					'range' => $range,
					'tooltip' => "Waktu %d-%m-%Y %H:%M"
				);

				$dataparam = json_encode($dataAnalisa);
				$data['data_sensor'] = json_decode($dataparam);
			}
			$data['pilih_pos'] = $this->db->get('t_prisma')->result();
			if($site == 'viewpoint'){
				$vp = [
					[
						'id_prisma'=>'P1',
						'nama_prisma'=>'TS_1',
					],
					[
						'id_prisma'=>'P2',
						'nama_prisma'=>'TS_2',
					],
					[
						'id_prisma'=>'P3',
						'nama_prisma'=>'P1',
					],
					[
						'id_prisma'=>'P4',
						'nama_prisma'=>'P2',
					],
					[
						'id_prisma'=>'P5',
						'nama_prisma'=>'P3',
					],
					[
						'id_prisma'=>'P6',
						'nama_prisma'=>'P4',
					],
					[
						'id_prisma'=>'P7',
						'nama_prisma'=>'P5',
					],
					[
						'id_prisma'=>'P8',
						'nama_prisma'=>'P6',
					]
				];
				$data['pilih_pos'] = json_decode(json_encode($vp)) ;
			}
			$data['pilih_parameter'] = $this->db->where('id_prisma',$this->session->userdata('id_prisma'))->get('parameter_prisma')->result();
			$data['data_first'] = $data_first;
			$data['data_last'] = $data_last; 
			$data['konten'] = 'konten/back/adr/analisa_adr';
			//$data['rpsm'] = $this->db->where('id_prisma',$this->session->userdata('id_prisma'))->get('t_prisma')->row();

			$this->load->view('template_admin/site', $data);
		} else {
			redirect('login');
		}
	}

	function set_dashlogger()
	{
		$tabel = $this->input->get('tabel');
		$idparam = $this->input->get('id_param');

		$this->session->set_userdata('id_param', $this->input->get('id_param'));
		$this->session->set_userdata('tabel', $tabel);
		$tgl = date('Y-m-d');
		$this->session->set_userdata('pada', $tgl);
		$this->session->set_userdata('data', 'hari');
		$this->session->set_userdata('tanggal', $tgl);

		$q_parameter = $this->db->query("SELECT * FROM parameter_sensor where id_param='" . $idparam . "'");
		if ($q_parameter->num_rows() > 0) {
			$parameter = $q_parameter->row();
			//data hasil seleksi dimasukkan ke dalam $session
			$session = array(
				'id_logger' => '30002',
				'id_parameter' => $parameter->id_param,
				'nama_param' => $parameter->nama_parameter,
				'kolom_logger' => $parameter->kolom_sensor,
				'satuan_logger' => $parameter->satuan,
				'tipe_grafik' => $parameter->tipe_graf,

			);
			//data dari $session akhirnya dimasukkan ke dalam session
			$this->session->set_userdata($session);
			$querylogger = $this->db->query('select * from t_logger INNER JOIN t_lokasi ON t_logger.lokasi_logger=t_lokasi.idlokasi where id_logger="' . $parameter->logger_id . '";');
			$log = $querylogger->row();
			$lokasilog = $log->nama_lokasi;
			$this->session->set_userdata('namalokasi', $lokasilog);
		}
		$this->session->set_userdata('controller', 'adr');
		redirect('adr/analisa_logger');
	}

	public function pilihposadr()
	{
		$data = array();

		$q_pos = $this->db->query("SELECT * FROM t_logger INNER JOIN t_lokasi ON t_logger.lokasi_logger = t_lokasi.idlokasi where kategori_log='1'");

		foreach ($q_pos->result() as $pos) {
			$data[] = array(
				'idLogger' => $pos->id_logger, 'namaPos' => $pos->nama_lokasi
			);
		}

		$data_pos = json_encode($data);
		return json_decode($data_pos);
	}


	public function pilihparameter($idlogger)
	{
		$data = array();
		$q_parameter = $this->db->query("SELECT * FROM parameter_sensor where logger_id='30002' and analisa = 1");
		foreach ($q_parameter->result() as $param) {
			$data[] = array(
				'idParameter' => $param->id_param, 'namaParameter' => $param->nama_parameter, 'fieldParameter' => $param->kolom_sensor
			);
		}

		$data_param = json_encode($data);
		return json_decode($data_param);
	}

	function set_parameter2()
	{
		$q_parameter = $this->db->query("SELECT * FROM parameter_sensor where id_param='" . $this->input->post('mnsensor') . "'");
		$this->session->set_userdata('id_param', $this->input->post('mnsensor'));
		if ($q_parameter->num_rows() > 0) {
			$parameter = $q_parameter->row();
			//data hasil seleksi dimasukkan ke dalam $session
			$session = array(
				'id_logger' => $parameter->logger_id,
				'id_parameter' => $parameter->id_param,
				'nama_param' => $parameter->nama_parameter,
				'kolom_logger' => $parameter->kolom_sensor,
				'satuan_logger' => $parameter->satuan,
				'tipe_grafik' => $parameter->tipe_graf,
			);
			//data dari $session akhirnya dimasukkan ke dalam session
			$this->session->set_userdata($session);
		}
		redirect('adr/analisa_logger');
	}

	function sesi_data()
	{
		if ($this->input->post('data') == 'hari') {
			$tgl = date('Y-m-d');
			$this->session->set_userdata('pada', $tgl);
		} elseif ($this->input->post('data') == 'bulan') {
			$tgl = date('Y-m');
			$this->session->set_userdata('bulan', $tgl);
			$this->session->set_userdata('pada', $tgl);
		} elseif ($this->input->post('data') == 'tahun') {
			$tgl = date('Y');
			$this->session->set_userdata('tahun', $tgl);
			$this->session->set_userdata('pada', $tgl);
		} elseif ($this->input->post('data') == 'range') {
			$dari = date('Y-m-d H:i', (mktime(date('H'), 0, 0, date('m'), date('d') - 1, date('Y'))));

			$sampai = date('Y-m-d H:i', (mktime(date('H'), 0, 0, date('m'), date('d'), date('Y'))));

			$this->session->set_userdata('dari', $dari);
			$this->session->set_userdata('sampai', $sampai);
		}
		$this->session->set_userdata('data', $this->input->post('data'));
		redirect('adr/analisa_logger');
	}

	function analisa_logger()
	{

		if ($this->session->userdata('logged_in')) {
			$data = array();
			$data_tabel = array();
			$min = array();
			$max = array();
			$range = array();
			####################################################################################### HARI ##################
			if ($this->session->userdata('data') == 'hari') {
				$sensor = $this->session->userdata('kolom_logger');
				$nama_sensor = "Rerata_" . $this->session->userdata('nama_param');

				$kolom = $this->session->userdata('kolom_logger');

				$select = 'avg(' . $kolom . ') as ' . $nama_sensor;
				$satuan = $this->session->userdata('satuan_logger');

				$query_data = $this->db->query("SELECT waktu, HOUR(waktu) as jam,DAY(waktu) as hari,MONTH(waktu) as bulan,YEAR(waktu) as tahun," . $select . ",min(" . $kolom . ") as min,max(" . $kolom . ") as max FROM rts where code_logger='" . $this->session->userdata('id_logger') . "' and waktu >= '".$this->session->userdata('pada')." 00:00' and waktu <= '".$this->session->userdata('pada')." 23:59' group by HOUR(waktu),DAY(waktu),MONTH(waktu),YEAR(waktu) order by waktu asc;");

				foreach ($query_data->result() as $datalog) {
					//$waktu[]= date('Y-m-d H',strtotime($datalog->waktu)).":00";

					$data[] = "[ Date.UTC(" . $datalog->tahun . "," . $datalog->bulan . "-1," . $datalog->hari . "," . $datalog->jam . ")," . number_format($datalog->$nama_sensor, 3) . "]";
					$range[] = "[ Date.UTC(" . $datalog->tahun . "," . $datalog->bulan . "-1," . $datalog->hari . "," . $datalog->jam . ")," . $datalog->min . "," . $datalog->max . "]";
					$data_tabel[] = array(
						'waktu' => date('H',strtotime($datalog->waktu)) .':00:00',
						'dta' => number_format($datalog->$nama_sensor, 2),
						'min' => number_format($datalog->min, 2),
						'max' => number_format($datalog->max, 2)
					);
				}


				$dataAnalisa = array(
					'idLogger' => $this->session->userdata('id_logger'),
					'namaSensor' => $nama_sensor,
					'satuan' => $satuan,
					'tipe_grafik' => $this->session->userdata('tipe_grafik'),
					'data' => $data,
					'data_tabel' => $data_tabel,
					'nosensor' => $kolom,
					'range' => $range,
					'tooltip' => "Waktu %d-%m-%Y %H:%M"
				);
				$dataparam = json_encode($dataAnalisa);
				$data['data_sensor'] = json_decode($dataparam);
			}
			####################################################################################### BULAN ##################
			elseif ($this->session->userdata('data') == 'bulan') {
				$sensor = $this->session->userdata('kolom_logger');
				$nama_sensor = "Rerata_" . $this->session->userdata('nama_param');

				$kolom = $this->session->userdata('kolom_logger');

				$select = 'avg(' . $kolom . ') as ' . $nama_sensor;
				$satuan = $this->session->userdata('satuan_logger');

				$query_data = $this->db->query("SELECT waktu, DATE(waktu) as tanggal, DAY(waktu) as hari,MONTH(waktu) as bulan,YEAR(waktu) as tahun," . $select . ",min(" . $kolom . ") as min,max(" . $kolom . ") as max FROM rts where code_logger='" . $this->session->userdata('idlogger') . "' and waktu >= '".$this->session->userdata('pada')."-01 00:00' and waktu <= '".$this->session->userdata('pada')."-31 23:59' group by DAY(waktu),MONTH(waktu),YEAR(waktu)  order by waktu asc;");
				foreach ($query_data->result() as $datalog) {
					//$waktu[]= date('Y-m-d H',strtotime($datalog->waktu)).":00";
					$data[] = "[ Date.UTC(" . $datalog->tahun . "," . $datalog->bulan . "-1," . $datalog->hari . ")," . number_format($datalog->$nama_sensor, 3) . "]";
					$range[] = "[ Date.UTC(" . $datalog->tahun . "," . $datalog->bulan . "-1," . $datalog->hari . ")," . $datalog->min . "," . $datalog->max . "]";
					$data_tabel[] = array(
						'waktu' => date('Y-m-d',strtotime($datalog->waktu)) ,
						'dta' => number_format($datalog->$nama_sensor, 2),
						'min' => number_format($datalog->min, 2),
						'max' => number_format($datalog->max, 2)
					);
				}



				$dataAnalisa = array(
					'idLogger' => $this->session->userdata('idlogger'),
					'namaSensor' => $nama_sensor,
					'satuan' => $satuan,
					'tipe_grafik' => $this->session->userdata('tipe_grafik'),
					'data' => $data,
					'data_tabel' => $data_tabel,
					'nosensor' => $sensor,
					'range' => $range,
					'tooltip' => "Tanggal %d-%m-%Y"
				);
				$dataparam = json_encode($dataAnalisa);
				$data['data_sensor'] = json_decode($dataparam);
			}
			####################################################################################### TAHUN ##################
			elseif ($this->session->userdata('data') == 'tahun') {
				$sensor = $this->session->userdata('kolom_logger');
				$nama_sensor = "Rerata_" . $this->session->userdata('nama_param');

				$kolom = $this->session->userdata('kolom_logger');

				$select = 'avg(' . $kolom . ') as ' . $nama_sensor;
				$satuan = $this->session->userdata('satuan_logger');

				$query_data = $this->db->query("SELECT DATE(waktu) as tanggal,MONTH(waktu) as bulan,YEAR(waktu) as tahun," . $select . ",min(" . $kolom . ") as min,max(" . $kolom . ") as max FROM rts where code_logger='" . $this->session->userdata('idlogger') . "' and waktu >= '".$this->session->userdata('pada')."-01-01 00:00' and waktu <= '".$this->session->userdata('pada')."-12-31 23:59' group by MONTH(waktu),YEAR(waktu)  order by waktu asc;");
				$dbt = 0;
				foreach ($query_data->result() as $datalog) {
					//$waktu[]= date('Y-m-d H',strtotime($datalog->waktu)).":00";
					$data[] = "[ Date.UTC(" . $datalog->tahun . "," . $datalog->bulan . "-1)," . number_format($datalog->$nama_sensor, 3) . "]";
					$range[] = "[ Date.UTC(" . $datalog->tahun . "," . $datalog->bulan . "-1)," . $datalog->min . "," . $datalog->max . "]";
					$data_tabel[] = array(
						'waktu' => date('Y-m',strtotime($datalog->tanggal)) ,
						'dta' => number_format(number_format($datalog->$nama_sensor, 3), 2),
						'min' => number_format($datalog->min, 2),
						'max' => number_format($datalog->max, 2)
					);
				}


				$dataAnalisa = array(
					'idLogger' => $this->session->userdata('idlogger'),
					'namaSensor' => $nama_sensor,
					'satuan' => $satuan,
					'tipe_grafik' => $this->session->userdata('tipe_grafik'),
					'data' => $data,
					'data_tabel' => $data_tabel,
					'nosensor' => $sensor,
					'range' => $range,
					'tooltip' => "Tanggal %d-%m-%Y"
				);
				$dataparam = json_encode($dataAnalisa);
				$data['data_sensor'] = json_decode($dataparam);
			}
			####################################################################################### RANGE ##################
			elseif ($this->session->userdata('data') == 'range') {

				$sensor = $this->session->userdata('kolom_logger');
				$nama_sensor = "Rerata_" . $this->session->userdata('nama_param');

				$kolom = $this->session->userdata('kolom_logger');

				$select = 'avg(' . $kolom . ') as ' . $nama_sensor;
				$satuan = $this->session->userdata('satuan_logger');


				$query_data = $this->db->query("SELECT waktu,DATE(waktu) as tanggal, HOUR(waktu) as jam,DAY(waktu) as hari,MONTH(waktu) as bulan,YEAR(waktu) as tahun," . $select . ",min(" . $kolom . ") as min,max(" . $kolom . ") as max FROM rts where code_logger='" . $this->session->userdata('idlogger') . "' and waktu >='" . $this->session->userdata('dari') . "' and waktu <='" . $this->session->userdata('sampai') . "' group by HOUR(waktu),DAY(waktu),MONTH(waktu),YEAR(waktu) order by waktu asc;");


				foreach ($query_data->result() as $datalog) {
					//$waktu[]= date('Y-m-d H',strtotime($datalog->waktu)).":00";
					$data[]= "[ Date.UTC(".$datalog->tahun.",".$datalog->bulan."-1,".$datalog->hari.",".$datalog->jam."),".number_format($datalog->$nama_sensor,3) ."]";
					$range[] ="[ Date.UTC(".$datalog->tahun.",".$datalog->bulan."-1,".$datalog->hari.",".$datalog->jam."),". $datalog->min.",". $datalog->max ."]";
					$data_tabel[] = array(
						'waktu' => date('Y-m-d H',strtotime($datalog->waktu)) .':00:00' ,
						'dta' => number_format($datalog->$nama_sensor, 3),
						'min' => number_format($datalog->min, 2),
						'max' => number_format($datalog->max, 2)
					);
				}



				$dataAnalisa = array(
					'idLogger' => $this->session->userdata('idlogger'),
					'namaSensor' => $nama_sensor,
					'satuan' => $satuan,
					'tipe_grafik' => $this->session->userdata('tipe_grafik'),
					'data' => $data,
					'data_tabel' => $data_tabel,
					'nosensor' => $sensor,
					'range' => $range,
					'tooltip' => "Waktu %d-%m-%Y %H:%M",
					'tooltipper' => "Waktu %d-%m-%Y %H:%M"
				);
				$dataparam = json_encode($dataAnalisa);
				$data['data_sensor'] = json_decode($dataparam);
			}

			$data['pilih_pos'] = $this->pilihposadr();
			$data['pilih_parameter'] = $this->pilihparameter($this->session->userdata('idlogger'));
			$data['konten'] = 'konten/back/adr/analisa_adr2';
			$this->load->view('template_admin/site', $data);
		} else {
			redirect('login');
		}
	}

	function update_schedule() {
		$data = $this->db->get('scheduling_task')->result_array();


		foreach($data as $k => $v){
			$name_input = $this->input->post($v['id']);
			if($name_input){
				$input_name = 'time_'.$v['id'];
				$time_input = $this->input->post($input_name);
				$dt = [
					'status'=>'1',
					'time'=>$time_input,
				];
				$this->db->where('id',$v['id'])->update('scheduling_task',$dt);
			}else{
				$dt = [
					'status'=>'0',
				];
				$this->db->where('id',$v['id'])->update('scheduling_task',$dt);
			}

		}
		redirect('adr/kontrol');
	}

}
