<?php if ( ! defined('BASEPATH')) exit('No direct script access allowed');

class Datamasuk extends CI_Controller {
	function __construct() {
		parent::__construct();

		$this->load->model('m_inputdata');
		$this->load->library('PhpMQTT');
		$this->load->library('Csvimport');
	}

	public function sesi_logger()
	{
		$this->session->set_userdata('log_id', $this->input->post('logger_id'));
		redirect('datamasuk');
	}

	function tgl_search()
	{
		$date = date_create($this->input->post('tgl'));
		$tgl = date_format($date, "Y-m-d");
		$this->session->set_userdata('tgl_search', $tgl);
		redirect('datamasuk');
	}


	public function add_adr()
	{
		$tgl=GETDATE();
		$tanggal = $this->input->post('tanggal');
		$jam = $this->input->post('jam');
		$waktu = $tanggal.' '.$jam;
		$id_log = '';
		if($this->input->post('sensor1')){
			$get_log= $this->db->where('id_logger',$this->input->post('id_alat'))->order_by('datetime','desc')->limit(1)->get('log_kontrol')->row();
			if($get_log){
				$id_log = $get_log->id_log;
				$update_log = [
					'prisma'=>$this->input->post('sensor1')
				];
				echo json_encode($update_log);
				$this->db->where('id_log',$id_log)->update('log_kontrol',$update_log);
			}
			$data_prisma = [
				'id_prisma'=>$this->input->post('sensor1'),
				'waktu'=>$waktu,
				'N1'=>$this->input->post('sensor8'),
				'E1'=>$this->input->post('sensor9'),
				'Z1'=>$this->input->post('sensor10'),
				'N0'=>$this->input->post('sensor11'),
				'E0'=>$this->input->post('sensor12'),
				'Z0'=>$this->input->post('sensor13'),
				'status_get'=>'1',
			];
			$this->db->where('id_prisma',$this->input->post('sensor1'))->update('temp_prisma',$data_prisma);
			
			$nama_prisma=[
				'nama_prisma'=>$this->input->post('sensor3')
			];
			$this->db->where('id_prisma',$this->input->post('sensor1'))->update('t_prisma',$nama_prisma);
			
			$server = 'mqtt.beacontelemetry.com';
			$port = 8883;
			$username = 'userlog';
			$password = 'b34c0n';
			$client_id = 'bemqtt-rts-ciawi';
			$ca = "/etc/ssl/certs/ca-bundle.crt";
			$mqtt = new phpMQTT($server, $port, $client_id, $ca);
			if ($mqtt->connect(true, NULL, $username, $password)) {
				$mqtt->publish('rts-' .$this->input->post('id_alat'), json_encode($data_prisma), 0, false);
				$mqtt->close();
			} else {
				echo "Time out!\n";
			}
		}
		
		$data = array (
			'code_logger'=>$this->input->post('id_alat'),
			'id_kontrol'=>$id_log,
			'waktu'=>$waktu,
			'sensor1'=>$this->input->post('sensor1'),
			'sensor2'=>$this->input->post('sensor2'),
			'sensor3'=>$this->input->post('sensor3'),
			'sensor4'=>$this->input->post('sensor4'),
			'sensor5'=>$this->input->post('sensor5'),
			'sensor6'=>$this->input->post('sensor6'),
			'sensor7'=>$this->input->post('sensor7'),
			'sensor8'=>$this->input->post('sensor8'),
			'sensor9'=>$this->input->post('sensor9'),
			'sensor10'=>$this->input->post('sensor10'),
			'sensor11'=>$this->input->post('sensor11'),
			'sensor12'=>$this->input->post('sensor12'),
			'sensor13'=>$this->input->post('sensor13'),
			'sensor14'=>$this->input->post('sensor14'),
			'sensor15'=>$this->input->post('sensor15'),
			'sensor16'=>$this->input->post('sensor16'),
			'sensor17'=>$this->input->post('sensor17'),
			'sensor18'=>$this->input->post('sensor18'),
			'sensor19'=>$this->input->post('sensor19'),
			'sensor20'=>$this->input->post('sensor20'),
			'sensor21'=>$this->input->post('sensor21'),
			'sensor22'=>$this->input->post('sensor22'),
			'sensor23'=>$this->input->post('sensor23'),
		);

		$this->db->insert('rts',$data);
		$this->db->where('code_logger',$this->input->post('id_alat'))->update('temp_rts',$data);
		
		$cek_kontrol = $this->db->where('id_logger',$this->input->post('id_alat'))->get('set_tempkontrol')->row();
		if($cek_kontrol->status == '1' and $this->input->post('sensor16') == '1'){
			$send_db2 = [
				'status'=>0,
				'status_manual'=>1,
			];
			$this->db->where('id_logger',$this->input->post('id_alat'));
			$this->db->update('set_tempkontrol',$send_db2);
		}elseif($cek_kontrol->status == '0' and $cek_kontrol->status_manual == '0' and $this->input->post('sensor16') == '1'){
			$send_db2 = [
				'status_manual'=>1,
			];
			$this->db->where('id_logger',$this->input->post('id_alat'));
			$this->db->update('set_tempkontrol',$send_db2);
		}elseif($cek_kontrol->status_manual == '1' and $this->input->post('sensor16') == '0'){
			$send_db2 = [
				'status'=>0,
				'status_manual'=>0,
			];
			$this->db->where('id_logger',$this->input->post('id_alat'));
			$this->db->update('set_tempkontrol',$send_db2);
			$server = 'mqtt.beacontelemetry.com';
			$port = 8883;
			$username = 'userlog';
			$password = 'b34c0n';
			$client_id = 'bemqtt-rts-ciawi';
			$ca = "/etc/ssl/certs/ca-bundle.crt";
			$mqtt = new phpMQTT($server, $port, $client_id, $ca);
			if ($mqtt->connect(true, NULL, $username, $password)) {
				$mqtt->publish('kontrol-asaba', json_encode($send_db2), 0, false);
				$mqtt->close();
			} else {
				echo "Time out!\n";
			}
		}
		if(!empty($this->input->post('sn')))
		{
			$query_inf=$this->db->query('select serial_number from t_informasi where logger_id = "'.$this->input->post('id_alat').'"');
			foreach($query_inf->result() as $inf)
			{

				if($inf->serial_number != $this->input->post('sn'))
				{
					$updata_inf = array(
						'serial_number'=>$this->input->post('sn'),

					);
					$this->db->where('logger_id', $this->input->post('id_alat'));
					$this->db->update('t_informasi', $updata_inf);
				}
			}
		}
	}
	
	
	public function selesai_kontrol () {
		$data = [
			'status_get'=>'1'
		];
		$this->db->update('temp_prisma',$data);
		
	}


	public function index()
	{
		if (empty($this->session->userdata('tgl_search'))) {
			$tgl = date('Y-m-d');
			$this->session->set_userdata('tgl_search', $tgl);
		}
		$id_logger = $this->session->userdata('log_id');
		$data['list_logger'] = $this->db->order_by('id_logger','asc')->get('t_logger')->result_array();

		$ky = [];
		$tabel = new stdClass();

		if($id_logger == '10268'){
			$tabel->tabel = 'baterai';
		}else{
			$tabel = $this->db->join('kategori_logger', 'kategori_logger.id_katlogger = t_logger.kategori_log')->where('t_logger.id_logger', $id_logger)->get('t_logger')->row();
		}
		if ($tabel) {
			$data['data'] = $this->db->query('SELECT * FROM ' . $tabel->tabel . ' where code_logger="' . $id_logger . '" and waktu >= "' . $this->session->userdata('tgl_search') . ' 00:00" and waktu <= "' . $this->session->userdata('tgl_search') . ' 23:59" ORDER BY waktu desc,sensor1 asc')->result_array();
			$data['tabel'] = $tabel->tabel;
			if($data['data']){
				foreach ($data['data'][0] as $key => $vl) {
					$ky[] = ['key'=>$key];
				}
				$data['key'] = $ky;
			}else{
				$data['key'] = $ky;
			}

			$data20 =  $this->db->query('select count(DISTINCT waktu) as waktu from '.$tabel->tabel.' where code_logger="'.$this->session->userdata('log_id').'" and waktu >= "'.  $this->session->userdata('tgl_search').'  00:00" and  waktu <= "'.  $this->session->userdata('tgl_search').'  23:59" ')->row();
			$current_time = time();
			$current_minute = date('i', $current_time);
			$total_minutes = ((int)date('H', $current_time) * 60) + (int)$current_minute;
			$data_count = $data20->waktu;
			if ($this->session->userdata('tgl_search') == date('Y-m-d')) {
				$tgl = date('Y-m-d H:i');

				if ($data_count > $total_minutes) {
					$data_count = $total_minutes;
				}
				$res = number_format(($data_count / $total_minutes * 100), 2);
				$res2 = $res . ' %';
			} else {
				$tgl = $this->session->userdata('tgl_search');
				$total_minutes = 1440;
				$res = number_format(($data_count / 1440 * 100), 2);
				$res2 = $res . ' %';
			}
			$data['data_count'] = $data_count;
			$data['total_minutes'] = $total_minutes;
		} else {
			$data['data'] = array();
			$data['tabel'] = null;
			$data['data_count'] = 0;
			$data['total_minutes'] = 0;
		}
		if($ky){
			foreach($data['key'] as $k=> $vl){
				$param = $this->db->where('kolom_sensor',$vl['key'])->where('logger_id',$this->session->userdata('log_id'))->get('parameter_sensor')->row();

				if($tabel->tabel == 'awgc'){
					$p_pintu = $this->db->where('kolom_sensor',$vl['key'])->get('parameter_pintu')->row();
					if($p_pintu){
						$data['key'][$k]['nama'] = $p_pintu->nama_parameter;
					}else{
						$data['key'][$k]['nama'] = '';	
					}
				}else{
					if($param){
						$data['key'][$k]['nama'] = $param->nama_parameter;
					}else{
						$data['key'][$k]['nama'] = '';	
					}
				}
			}

		}else{
			$data['key'] = $ky;
		}
		$this->load->view('konten/inputdata/view_alldata', $data);
	}

}
