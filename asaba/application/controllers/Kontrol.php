<?php if (!defined('BASEPATH')) exit('No direct script access allowed');

class Kontrol extends CI_Controller
{
	function __construct()
	{
		parent::__construct();
		$this->load->library('PhpMQTT');
	}
	public function index () {
		$id_logger=  $this->input->get('idlogger');

		$waktu= str_replace('%20',' ',$this->input->get('waktu'));
		$data = $this->db->where('id_logger',$id_logger)->get('set_tempkontrol')->result_array();

		$dt = [];
		$i = 1;
		$a = 1;
		foreach($data as $key=>$vl){
			$dt['rts'] = $vl['status'];
		}


		echo json_encode($dt);
	}

	public function stop_kontrol () {
		$data = $this->input->post('data');
		foreach($data as $k => $dt){
			$send_kontrol = [
				'set_value'=>'0',
				'status'=>'2',
			];
			$this->db->where('id_pintu',$dt['id_pintu']);
			$this->db->update('set_tempkontrol',$send_kontrol);
		}
		echo json_encode(['status'=>'success']);
	}

	public function stop_kontrol2 () {
		$data = $this->input->post('data');
		$st = json_decode($data);
		foreach($st as $k => $dt){
			$send_kontrol = [
				'set_value'=>'0',
				'status'=>'2',
			];
			$this->db->where('id_pintu',$dt->id_pintu);
			$this->db->update('set_tempkontrol',$send_kontrol);
		}
		echo json_encode(['status'=>'success']);
	}

	public function lanjut_kontrol(){
		$kode_akses = $this->db->where('id_user', '2')->get('kode_akses')->row();

		$inp = md5($this->input->post('akses'));
		$server = 'mqtt.beacontelemetry.com';
		$port = 8883;
		$username = 'userlog';
		$password = 'b34c0n';
		$client_id = 'bemqtt-rts-ciawi';
		$ca = "/etc/ssl/certs/ca-bundle.crt";
		$mqtt = new phpMQTT($server, $port, $client_id, $ca);

		if($kode_akses->kode_akses != $inp){
			echo json_encode(['status'=>'error']);
		}else{
			$date_now = date('Y-m-d H:i:s');
			$send_kontrol = [
				'status'=>'1',
				'status_manual'=>'1',
				'datetime'=>$date_now,
			];
			$this->db->where('id_logger','30002');
			$this->db->update('set_tempkontrol',$send_kontrol);

			$status = [];

			$data_mqtt = [
				"set_30002" => [
					"command" => "set_rts",
					"AutoTrackingStart" => true
				]
			];

			if ($mqtt->connect(true, NULL, $username, $password)) {
				$mqtt->publish('kontrol-asaba', json_encode($send_kontrol), 0, false);
				$mqtt->publish('ADR_Tambang_Kaltara', json_encode($data_mqtt), 0, false);
				$mqtt->close();
			} else {
				echo "Time out!\n";
			}

			$data_prisma = $this->db->where('id_logger','30002')->get('t_prisma')->result_array();
			foreach($data_prisma as $k => $vl){
				$status_get = [
					'status_get'=>0
				];
				$this->db->where('id_prisma',$vl['id_prisma'])->update('temp_prisma',$status_get);
			}

			$id_log = date('His');
			$data_log = [
				'id_log'=>$id_log,
				'id_logger'=>'30002',
				'datetime'=>$date_now
			];
			$this->db->insert('log_kontrol',$data_log);
			echo json_encode(['status'=>'success']);
		}
	}

	public function kontrol_job(){
		$inp = md5($this->input->post('akses'));
		$server = 'mqtt.beacontelemetry.com';
		$port = 8883;
		$username = 'userlog';
		$password = 'b34c0n';
		$client_id = 'bemqtt-rts-ciawi';
		$ca = "/etc/ssl/certs/ca-bundle.crt";
		$mqtt = new phpMQTT($server, $port, $client_id, $ca);


		$date_now = date('Y-m-d H:i:s');
		$cek_kontrol = $this->db->get('set_tempkontrol')->row();
		if($cek_kontrol->status_manual == '1'){
			$data = [
				'datetime' => date('Y-m-d H:i:s'),
				'status' =>0,
			];
			//$this->db->insert('tes_cronjob',$data);
		}else{
			$date_now = date('Y-m-d H:i:s');
			$send_kontrol = [
				'status'=>'1',
				'status_manual'=>'1',
				'datetime'=>$date_now,
			];
			$this->db->where('id_logger','30002');
			$this->db->update('set_tempkontrol',$send_kontrol);

			$status = [];

			$data_mqtt = [
				"set_30002" => [
					"command" => "set_rts",
					"AutoTrackingStart" => true
				]
			];

			if ($mqtt->connect(true, NULL, $username, $password)) {
				$mqtt->publish('kontrol-asaba', json_encode($send_kontrol), 0, false);
				$mqtt->publish('ADR_Tambang_Kaltara', json_encode($data_mqtt), 0, false);
				$mqtt->close();
			} else {
				echo "Time out!\n";
			}

			$data_prisma = $this->db->where('id_logger','30002')->get('t_prisma')->result_array();
			foreach($data_prisma as $k => $vl){
				$status_get = [
					'status_get'=>0
				];
				$this->db->where('id_prisma',$vl['id_prisma'])->update('temp_prisma',$status_get);
			}

			$id_log = date('His');
			$data_log = [
				'id_log'=>$id_log,
				'id_logger'=>'30002',
				'datetime'=>$date_now
			];
			$this->db->insert('log_kontrol',$data_log);
			echo json_encode(['status'=>'success']);
			$data = [
				'datetime' => date('Y-m-d H:i:s'),
				'status' =>1,
			];
			//$this->db->insert('tes_cronjob',$data);
		}


	}

	function tes_cronjob(){
		$days = date('N');
		$minute = date('H:i');
		$jadwal = $this->db->where('days',$days)->where('status','1')->where('time',$minute)->get('scheduling_task')->row();
		if($jadwal){
			$this->kontrol_job();
		}else{
			echo 'raono';
		}
	}

	public function lanjut_kontrol_manual(){
		$kode_akses = $this->db->where('id_user', '2')->get('kode_akses')->row();

		$server = 'mqtt.beacontelemetry.com';
		$port = 8883;
		$username = 'userlog';
		$password = 'b34c0n';
		$client_id = 'bemqtt-rts-ciawi';
		$ca = "/etc/ssl/certs/ca-bundle.crt";
		$mqtt = new phpMQTT($server, $port, $client_id, $ca);

		$date_now = date('Y-m-d H:i:s');
		$send_kontrol = [
			'status_manual'=>'1',
			'datetime'=>$date_now,
		];
		$this->db->where('id_logger','10284');
		$this->db->update('set_tempkontrol',$send_kontrol);

		$status = [];
		if ($mqtt->connect(true, NULL, $username, $password)) {
			$mqtt->publish('kontrol-ciawi', json_encode($send_kontrol), 0, false);
			$mqtt->close();
		} else {
			echo "Time out!\n";
		}

		$data_prisma = $this->db->where('id_logger','10284')->get('t_prisma')->result_array();
		foreach($data_prisma as $k => $vl){
			$status_get = [
				'status_get'=>0
			];
			$this->db->where('id_prisma',$vl['id_prisma'])->update('temp_prisma',$status_get);
		}

		$id_log = date('His');
		$data_log = [
			'id_log'=>$id_log,
			'id_logger'=>'10284',
			'datetime'=>$date_now
		];
		$this->db->insert('log_kontrol',$data_log);
		echo json_encode(['status'=>'success']);

	}

	function tes () {
		$data_prisma = $this->db->where('id_logger','10285')->get('t_prisma')->result_array();
		foreach($data_prisma as $k => $vl){
			$status_get = [
				'status_get'=>1
			];
			$this->db->where('id_prisma',$vl['id_prisma'])->update('temp_prisma',$status_get);
		}
	}

	public function status_kontrol () {
		$id_logger = $this->input->get('id_logger');
		$status = $this->db->where('id_logger',$id_logger)->get('status_kontrol')->row();
		$set_temp = $this->db->where('id_logger',$id_logger)->get('set_tempkontrol')->result_array();
		$nilai = [];
		foreach($set_temp as $k => $vl){
			$nilai[] = $vl['status'];
		}
		if($status->status_kontrol == '2' and in_array("1" ,$nilai)) {
			echo json_encode(['status_kontrol'=>'1']);
		}else{
			echo json_encode($status);
		}
		/*
		if(!in_array("1" ,$nilai)) {
			$send_db2 = [
				'status_kontrol'=>'0'
			];
			$this->db->where('id_logger',$id_logger);
			$this->db->update('status_kontrol',$send_db2);
		}
		*/
	}


	public function respon_logger () {
		$id_logger = $this->input->get('id_logger');
		$up = [
			'status_kontrol'=>'2',
		];
		$this->db->where('id_logger',$id_logger);
		$sts = $this->db->update('status_kontrol',$up);
		if($sts){
			echo json_encode(['status'=>'success']);	
		}else{
			echo json_encode(['status'=>'error']);	
		}
	}

	public function operasi () {
		$id_logger = $this->input->get('id_logger');
		$up = [
			'status_kontrol'=>'0',
			'session_id'=>'0',
		];
		$this->db->where('id_logger',$id_logger);
		$sts = $this->db->update('status_kontrol',$up);
		if($sts){
			echo json_encode(['status'=>'success']);	
		}else{
			echo json_encode(['status'=>'error']);	
		}
	}

	public function selesai_kontrol ($id_logger) {
		$list_pintu = $this->input->post('list_pintu');
		foreach($list_pintu as $key=>$val){
			if($val['elev_asli'] < $val['elev']){
				$sistem = '1';
			}else{
				$sistem = '0';
			}
			$data = [
				'id_logger'=>$id_logger,
				'id_pintu'=>$val['id_pintu'],
				'metode'=>'Telemetry',
				'dari'=>$val['elev_asli'],
				'ke'=>$val['elev'],
				'datetime'=>date('Y-m-d H:i:s'),
				'sistem'=>$sistem
			];
			$this->db->insert('log_kontrol',$data);
		}
		//$this->notif_aplikasi_selesai();
		echo json_encode($list_pintu);
	}

	public function selesai_kontrol2 ($id_logger) {
		$list_pintu = json_decode($this->input->post('list_pintu'));
		foreach($list_pintu as $key=>$val){

			if($val->elev_asli < $val->elev){
				$sistem = '1';
			}else{
				$sistem = '0';
			}
			$data = [
				'id_logger'=>$id_logger,
				'id_pintu'=>$val->id_pintu,
				'metode'=>'Telemetry',
				'dari'=>$val->elev_asli,
				'ke'=>$val->elev,
				'datetime'=>date('Y-m-d H:i:s'),
				'sistem'=>$sistem
			];
			$this->db->insert('log_kontrol',$data);
		}
		//$this->notif_aplikasi_selesai();
		echo json_encode($list_pintu);
	}

	public function selesai () {
		$server = 'mqtt.beacontelemetry.com';
		$port = 8883;
		$username = 'userlog';
		$password = 'b34c0n';
		$client_id = 'bemqtt-awgc-sepaku';
		$ca = "/etc/ssl/certs/ca-bundle.crt";
		$mqtt = new phpMQTT($server, $port, $client_id, $ca);
		$id_logger = $this->input->get('id_logger');
		$up = [
			'status_kontrol'=>'0'
		];
		$this->db->where('id_logger',$id_logger);
		$sts = $this->db->update('status_kontrol',$up);
		if ($mqtt->connect(true, NULL, $username, $password)) {
			$mqtt->publish('kontrol-sepaku', json_encode($up), 0, false);
			$mqtt->close();
		} else {
			echo "Time out!\n";
		}

		if($sts){
			echo json_encode(['status'=>'success']);	
		}else{
			echo json_encode(['status'=>'error']);	
		}
	}

	function kirim_riset () {
		$server = 'mqtt.beacontelemetry.com';
		$port = 8883;
		$username = 'userlog';
		$password = 'b34c0n';
		$client_id = 'bemqtt-tes';
		$ca = "/etc/ssl/certs/ca-bundle.crt";
		$mqtt = new phpMQTT($server, $port, $client_id, $ca);
		$send2 = 'AKWOKWOWKWO';
		if ($mqtt->connect(true, NULL, $username, $password)) {

			$mqtt->publish('arduino-sample', $send2, 0, false);
			$mqtt->close();
		} else {
			echo "Time out!\n";
		}
	}

	function receive_data () {
		$this->load->view('konten/back/v_setting');
	}

	function receive_data2 () {
		$this->load->view('konten/back/v_setting2');
	}

	public function notif_aplikasi(){
		$data = json_decode($this->input->post('data'));

		$a = '';
		$new = [];
		foreach($data as $key => $v){
			if (!in_array($v->id_pintu, $new)) {
				$new[] = $v->id_pintu;
			}
		}
		foreach($new as $key=> $vl ){
			$nama_pintu = $this->db->where('id_pintu', $vl)->get('t_pintu')->row();
			if($key != array_key_last($new)){
				$a .= $nama_pintu->nama_pintu . ', ';	
			}else{
				$a .= $nama_pintu->nama_pintu . '';	
			}
		}
		$data2 = [
			"message" => [
				"topic"=> "awgc-sepaku",
				"notification" => [
					"title"=> "Kontrol Pintu sedang Digunakan",
					"body" => "$a sedang beroperasi",
				],
			]
		];
		$optionsarr = [
			'http' => [
				'method' => 'POST',
				'header' => ['Content-Type: application/json','Authorization: Bearer ya29.a0AXooCgsqOglNk7GKqMlJEeglmk70bxe3HUV5rNaYc2u_XJe6tQxld_Ni46WrXfDoA1v6fddilKGF_A38gezq-1Wb1RLSwQPwFUiuMaReckEaMAYQ8-EuQyotMSXXS-K2C9X-QR5VanmzvS_8dpLxvC0p0Lr6iWomdCuXaCgYKAbkSARISFQHGX2Mij7nGXVtqz3GXMJvAYFrQzQ0171'],
				'content' => json_encode($data2),
			],
		];
		$contextarr = stream_context_create($optionsarr);
		$responsearr = file_get_contents('https://fcm.googleapis.com/v1/projects/sepaku-semoi/messages:send', false, $contextarr);

	}

	public function notif_aplikasi_selesai(){	
		$data = [
			"to" => '/topics/kontrol_pintu',
			"notification" => [
				"title" => 'AWGC Bendung Pasar Baru',
				"body" => "Kontrol Pintu dapat digunakan kembali",
			],
		];
		$optionsarr = [
			'http' => [
				'method' => 'POST',
				'header' => ['Content-Type: application/json','Authorization: key=AAAAPvfXgqY:APA91bFJV9tVwZGO9Zsqwk8bMBBRzv7CfLxZDuwU0MqrZ0EPyf5t2yZOONu2s8N5lTzj419OP1zZ6dRS_1UWxsa5Q-KTqxj8ZHhISnBsBdh2NBAIGZvBXid8VXgz3byTV0hqN8rc3311'],
				'content' => json_encode($data),
			],
		];
		$contextarr = stream_context_create($optionsarr);
		$responsearr = file_get_contents('https://fcm.googleapis.com/fcm/send', false, $contextarr);

	}
}