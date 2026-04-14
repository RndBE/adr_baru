<?php if ( ! defined('BASEPATH')) exit('No direct script access allowed');

class Api extends CI_Controller {

	function __construct()
	{
		parent :: __construct();
		$this->load->model('mlogin');
		$this->load->model('m_analisa');
	}
	
	public function receive()
    {
        // Ambil raw body
        $raw = file_get_contents("php://input");

        // Decode JSON
        $data = json_decode($raw, true);

        // Validasi
        if (!$data) {
            return $this->output
                ->set_status_header(400)
                ->set_content_type('application/json')
                ->set_output(json_encode([
                    'status' => false,
                    'message' => 'Invalid JSON'
                ]));
        }

        // Contoh: Simpan ke log file
        $log = "[" . date('Y-m-d H:i:s') . "] " . $raw . PHP_EOL;
        file_put_contents(APPPATH . 'logs/webhook.log', $log, FILE_APPEND);

        // Contoh: Balas sukses
        return $this->output
            ->set_status_header(200)
            ->set_content_type('application/json')
            ->set_output(json_encode([
                'status' => true,
                'message' => 'Webhook received',
                'received' => $data
            ]));
    }

	function login_app2()
	{
		$username = $this->input->get('username');
		$password = md5($this->input->get('password'));
		$this->mlogin->apiambilPengguna2($username, $password);

	}

	public function pilihparameter($idlogger)
	{
		$data=array();
		$q_parameter=$this->db->query("SELECT * FROM parameter_sensor where logger_id='".$idlogger."'");
		foreach($q_parameter->result() as $param)
		{
			$data[]=array(
				'idParameter'=>$param->id_param,'namaParameter'=>$param->nama_parameter,'fieldParameter'=>$param->kolom_sensor,
				'icon'=>$param->icon_sensor
			);
		}
		echo json_encode($data);
	}

	function lokasi_new(){
		$kategori=array();
		$data = array();
		$query_kategori=$this->db->query('select * from kategori_logger');
		//$klasifikasi
		foreach ($query_kategori->result()  as $kat) {
			$tabel=$kat->tabel;
			$tabel_temp=$kat->temp_data;
			$content=array();
			$query_lokasilogger=$this->db->query("select * from t_logger inner join t_lokasi ON t_logger.lokasi_logger=t_lokasi.idlokasi where kategori_log='$kat->id_katlogger'");


			foreach ($query_lokasilogger->result() as $loklogger){
				$id_logger=$loklogger->id_logger;
				
				$parameter=array();
				$query_data=$this->db->query('select * from '.$tabel_temp.' where code_logger="'.$id_logger.'"');
				foreach ($query_data->result() as $dt){
					$waktu=$dt->waktu;
					$awal=date('Y-m-d H:i',(mktime(date('H')-1)));
					$query_parameter=$this->db->query('select * from parameter_sensor where logger_id="'.$id_logger.'" limit 1');
					foreach ($query_parameter->result() as $param) {
						$kolom=$param->kolom_sensor;
						$dta=$dt->$kolom;
						$get='tabel='.$kat->tabel.'&id_param='.$param->id_param;
						$link_parameter= anchor($kat->controller.'/set_sensordash?'.$get,$param->nama_parameter);
						$parameter[]='
								<td>'.$link_parameter.'</td><td>'.$dta.' '.$param->satuan.'</td>
								';	
					}
					$data_sensor = $query_parameter->result_array()[0];
					######### cek status koneksi ######
					$dta=$dt->$kolom;
					$koneksi = '';
					if($waktu >= $awal)
					{
						$koneksi = 'Koneksi Terhubung';
						$kn = 'On';
						
							$icon_marker=$kat->controller.'_on';
						
					}else{
						$koneksi = 'Koneksi Terputus';
						$kn = 'Off';
						$icon_marker=$kat->controller.'_off';
					}

				}

				$data[] = array(
					'tabel' => $tabel,
					'sensor'=>$data_sensor['id_param'],
					'nama_param'=>$data_sensor['nama_parameter'],
					'icon_sensor'=>$data_sensor['icon_sensor'],
					'id_param'=>$data_sensor['id_param'],
					'lokasi'=>$loklogger->nama_lokasi,
					'latitude'=>$loklogger->latitude,
					'longitude'=>$loklogger->longitude,
					'id_logger'=>$id_logger,
					'waktu'=>$waktu,
					'koneksi'=>$koneksi,
					'koneksi_log'=>$kn,
					'icon' => $icon_marker,
				);
			}

		}
		echo json_encode($data);
	}

	function menu()
	{
		$dataMenu=array();
		$kategori=$this->db->query("SELECT * FROM kategori_logger");
		foreach ($kategori->result() as $kat) {
			$logger = $this->db->where('kategori_log',$kat->id_katlogger)->get('t_logger')->result_array();
			if($logger){
				$dataMenu[]=array(
					'id_kategori' =>$kat->id_katlogger,
					'menu' =>$kat->nama_kategori,
					'controller'=>$kat->controller,
					'tabel'=>$kat->tabel,
					'icon'=>$kat->icon_app,
					'temp_tabel'=>$kat->temp_data,	
				); 
			}
			
		}
		echo json_encode($dataMenu);
	}

	
	public function notif_versi(){
		$versi = '1.1.1';
		echo json_encode(array(
			'versi'=> $versi, 
			'link'=>'https://bagong.monitoring4system.com/unduh/bagong_1.1.1.apk',
			'status'=> true, 
			'pesan'=>'Sistem Sedang Dimatikan',
			
		));
	}

	public function notif_versi_ios(){
		$versi = '1.3.2';
		echo json_encode(array(
			'versi'=> $versi, 
			'link'=>'https://bagong.monitoring4system.com/unduh/bagong_1.1.0.apk',
			'status'=> true, 
			'pesan'=>'Sistem Menyala'));
	}


	function lokasi()
	{
		$kategori=$this->input->get('kategori_log');
		$tabel=$this->input->get('tabel');
		$dataLokasi=array();

		$query_lokasi = $this->db->query("SELECT * FROM t_logger join t_lokasi on t_logger.lokasi_logger=t_lokasi.idlokasi where kategori_log='".$kategori."'");
		foreach($query_lokasi->result() as $lokasilog)
		{
			$this->session->set_userdata('id_log',$lokasilog->id_logger);
			$query_perbaikan=$this->db->query('select * from t_perbaikan where id_logger="'.$lokasilog->id_logger.'" ');
			if($query_perbaikan->num_rows() == null) {
				$cek = $this->db->where('code_logger',$lokasilog->id_logger)->get($tabel)->row()->waktu;
				$date_now = date('Y:m:d H:i:s');
				$date = date('Y-m-d H:i:s', strtotime('-1 hour', strtotime($date_now)));
				if($cek > $date){
					$status = 'On';
				}else{
					$status = 'Off';
				}
				$dataLokasi[]=array(
					'logger_id' =>$lokasilog->id_logger,
					'nama_logger' =>$lokasilog->nama_logger,
					'lokasi' =>$lokasilog->nama_lokasi,
					'latitude'=>$lokasilog->latitude,
					'longitude'=>$lokasilog->longitude,
					'status'=>$status,
				);
			}
			else {
				$dataLokasi[]=array(
					'logger_id' =>$lokasilog->id_logger,
					'nama_logger' =>$lokasilog->nama_logger,
					'lokasi' =>$lokasilog->nama_lokasi,
					'latitude'=>$lokasilog->latitude,
					'longitude'=>$lokasilog->longitude,
					'status'=>"Perbaikan",	
				);
			}
		}
		echo json_encode(array('lokasi_first'=>$dataLokasi[0],'lokasi'=>$dataLokasi));
		//echo $this->session->userdata('id_log');
	}

	function dtakhir()
	{
		$idlog = $this->input->get('idlogger');
		$tabel = $this->input->get('tabel');
		$data_terakhir=array();
		$data_logger = $this->db->join('t_lokasi', 't_logger.lokasi_logger = t_lokasi.idlokasi')->where('t_logger.id_logger', $idlog)->get('t_logger')->row();
		$query_perbaikan=$this->db->query('select * from t_perbaikan where id_logger="'.$idlog.'" ');
		if($query_perbaikan->num_rows() == null)
		{

			$qparam=$this->db->query("SELECT * FROM parameter_sensor where logger_id='".$idlog."'");		
			foreach($qparam->result() as $sensor)
			{
				$kolom=$sensor->kolom_sensor;
				$kolom2=$sensor->kolom_acuan;
				$qdataparam=$this->db->query("SELECT * FROM ".$tabel." where code_logger='".$idlog."' order by waktu desc limit 1");

				foreach($qdataparam->result() as $data)
				{
					$datasensor=$data->$kolom;
					$waktu=$data->waktu;
					if($sensor->nama_parameter =='Illumination'){
						$datasensor = $datasensor/1000;
					}
				}
				if($sensor->nama_parameter != 'Wind_Direction'){
					$datasensor = number_format($datasensor,2,'.','');
				}
				$data_terakhir[]=array(
					'idsensor'=>$sensor->id_param,
					'sensor'=>$sensor->nama_parameter,
					'data'=>$datasensor,
					'satuan'=>$sensor->satuan,
					'icon'=>$sensor->icon_sensor,
					'tipe_graf'=>$sensor->tipe_graf,
				);
			}
			//echo json_encode()
			$a = null;
			$data_akhir=array(
				'nama_logger' => $data_logger->nama_lokasi,
				'waktu'=>$waktu,
				'tabel'=>$tabel,
				'data_terakhir'=>$data_terakhir);
			echo json_encode($data_akhir);
		}
		else {
			foreach($query_perbaikan->result() as $data_perbaikan) {
				$d_per=	$data_perbaikan->data_terakhir;
				$data_per = json_decode($d_per);
				$data_akhir = $data_per->kolom;
				$data_terakhir[]=array(
					'idsensor'=>$data_per->id_param,
					'sensor'=>$data_per->nama_parameter,
					'data'=>$data_akhir,
					'satuan'=>$data_per->satuan,
					'icon'=>$data_per->icon_sensor
				);

			}
			foreach($data_terakhir as $key => $dt3){
				$data_terakhir[$key]['kat_data'] = '1';
			}
			$data_akhir=array(
				'nama_logger' => $data_logger->nama_lokasi,
				'waktu'=>$data_per->waktu,
				'data_terakhir'=>$data_terakhir
			);
			echo json_encode($data_akhir);

		}

	}

	function analisapertanggal()
	{
		$idlogger=$this->input->get('idlogger');
		$idsensor=$this->input->get('idsensor');
		$tabel=$this->input->get('tabel');
		$tanggal=$this->input->get('tanggal');

		$data=array();
		$min=array();
		$max=array();

		$qparam=$this->db->query("SELECT * FROM parameter_sensor where id_param='".$idsensor."'");		
		foreach($qparam->result() as $param)
		{

			if($tabel == 't_klimatologi' && $param->kolom_sensor == 'sensor8')
			{
				$namaSensor='Akumulasi_'.$param->nama_parameter;
				$select='sum('.$param->kolom_sensor.')as '.$namaSensor;
			}elseif($tabel == 'arr' && $param->kolom_sensor == 'sensor9')
			{
				$namaSensor='Akumulasi_'.$param->nama_parameter;
				$select='sum('.$param->kolom_sensor.')as '.$namaSensor;
			}
			elseif($param->tipe_graf=='column')
			{
				$namaSensor='Akumulasi_'.$param->nama_parameter;
				$select='sum('.$param->kolom_sensor.')as '.$namaSensor;
			}
			else{
				$namaSensor='Rerata_'.$param->nama_parameter;
				$select='avg('.$param->kolom_sensor.')as '.$namaSensor;
			}

			$sensor=$param->kolom_sensor;
			if($param->nama_parameter == 'Debit') {
				$namaSensor='Rerata_'.$param->nama_parameter;
				$select='avg('.$param->kolom_acuan.')as '.$namaSensor;
				$sensor=$param->kolom_acuan;
			}
			$satuan=$param->satuan;
			$namaparameter=$param->nama_parameter;
		}
		$query_data = $this->db->query("SELECT waktu,".$select.",min(".$sensor.") as min,max(".$sensor.") as max FROM ".$tabel." where code_logger='".$idlogger."' and waktu >= '".$tanggal." 00:00' and waktu <= '".$tanggal." 23:59' group by HOUR(waktu),DAY(waktu),MONTH(waktu),YEAR(waktu);");
		$hsl = $query_data->result();

		foreach($hsl as $datalog)
		{
			$n_data = $datalog->$namaSensor;
			$max_value = $datalog->max;
			$min_value = $datalog->min;
			if($namaparameter =='Illumination'){
				$n_data = $n_data/1000;
				$max_value = $datalog->max/1000;
				$min_value = $datalog->min/1000;
			}
			$waktu[]= date('Y-m-d H',strtotime($datalog->waktu)).":00";
			$data[]= number_format($n_data,2,'.',''); 
			$min[]=number_format($min_value,2,'.','');
			$max[]=number_format($max_value,2,'.','');
		}
		if($hsl){
			$stts = 'sukses';
			$dataAnalisa=array(
				'status'=>'sukses',
				'idLogger' =>$idlogger,
				'nosensor'=>$sensor,
				'namaSensor' =>$namaSensor,
				'satuan'=>$satuan,
				'waktu' =>$waktu,
				'tipegraf'=>$param->tipe_graf,
				'data'=>$data,
				'datamin'=>$min,
				'datamax'=>$max,
			);
		}else{
			$stts = 'error';
			$dataAnalisa = null;
		}
		echo json_encode(
			array(
				'status' => $stts,
				'data'=>$dataAnalisa
			)
		);
	}

	function analisaperbulan()
	{
		$idlogger=$this->input->get('idlogger');
		$idsensor=$this->input->get('idsensor');
		$tabel=$this->input->get('tabel');
		$tanggal=$this->input->get('tanggal');

		$data=array();
		$min=array();
		$max=array();
		$waktu = [];
		$qparam=$this->db->query("SELECT * FROM parameter_sensor where id_param='".$idsensor."'");		
		foreach($qparam->result() as $param)
		{

			if($tabel == 't_klimatologi' && $param->kolom_sensor == 'sensor8')
			{
				$namaSensor='Akumulasi_'.$param->nama_parameter;
				$select='sum('.$param->kolom_sensor.')as '.$namaSensor;
			}elseif($tabel == 'arr' && $param->kolom_sensor == 'sensor9')
			{
				$namaSensor='Akumulasi_'.$param->nama_parameter;
				$select='sum('.$param->kolom_sensor.')as '.$namaSensor;
			}
			elseif($param->tipe_graf=='column')
			{
				$namaSensor='Akumulasi_'.$param->nama_parameter;
				$select='sum('.$param->kolom_sensor.')as '.$namaSensor;
			}
			else{
				$namaSensor='Rerata_'.$param->nama_parameter;
				$select='avg('.$param->kolom_sensor.')as '.$namaSensor;
			}
			$sensor=$param->kolom_sensor;
			if($param->nama_parameter == 'Debit') {
				$namaSensor='Rerata_'.$param->nama_parameter;
				$select='avg('.$param->kolom_acuan.')as '.$namaSensor;
				$sensor=$param->kolom_acuan;
			}
			$satuan=$param->satuan;
			$namaparameter=$param->nama_parameter;
		}
		$query_data = $this->db->query("SELECT waktu,DATE(waktu) as tanggal,".$select.",min(".$sensor.") as min,max(".$sensor.") as max FROM ".$tabel." where code_logger='".$idlogger."' and waktu >= '".$tanggal."-01 00:00' and waktu <= '".$tanggal."-31 23:59' group by DAY(waktu),MONTH(waktu),YEAR(waktu);");
		$dbt = 0;

		$hsl = $query_data->result();

		foreach($hsl as $datalog)
		{
			$n_data = $datalog->$namaSensor;
			$max_value = $datalog->max;
			$min_value = $datalog->min;
			if($namaparameter =='Illumination'){
				$n_data = $n_data/1000;
				$max_value = $datalog->max/1000;
				$min_value = $datalog->min/1000;
			}
			$waktu[]= date('Y-m-d',strtotime($datalog->waktu));
			$data[]= number_format($n_data,2,'.',''); 
			$min[]=number_format($min_value,2,'.','');
			$max[]=number_format($max_value,2,'.','');
		}

		if($hsl){
			$stts = 'sukses';
			$dataAnalisa=array(
				'status'=>'sukses',
				'idLogger' =>$idlogger,
				'nosensor'=>$sensor,
				'namaSensor' =>$namaSensor,
				'satuan'=>$satuan,
				'waktu' =>$waktu,
				'tipegraf'=>$param->tipe_graf,
				'data'=>$data,
				'datamin'=>$min,
				'datamax'=>$max,
			);

		}else{
			$stts = 'error';
			$dataAnalisa = null;
		}

		echo json_encode(
			array(
				'status' => $stts,
				'data'=>$dataAnalisa
			)
		);
	}


	function analisaperrange()
	{
		$idlogger=$this->input->get('idlogger');
		$idsensor=$this->input->get('idsensor');
		$tabel=$this->input->get('tabel');
		$awal=$this->input->get('awal');
		$akhir=$this->input->get('akhir');

		$data=array();
		$min=array();
		$max=array();
		$waktu = [];
		$qparam=$this->db->query("SELECT * FROM parameter_sensor where id_param='".$idsensor."'");		
		foreach($qparam->result() as $param)
		{

			if($tabel == 't_klimatologi' && $param->kolom_sensor == 'sensor8')
			{
				$namaSensor='Akumulasi_'.$param->nama_parameter;
				$select='sum('.$param->kolom_sensor.')as '.$namaSensor;
			}elseif($tabel == 'arr' && $param->kolom_sensor == 'sensor9')
			{
				$namaSensor='Akumulasi_'.$param->nama_parameter;
				$select='sum('.$param->kolom_sensor.')as '.$namaSensor;
			}
			elseif($param->tipe_graf=='column')
			{
				$namaSensor='Akumulasi_'.$param->nama_parameter;
				$select='sum('.$param->kolom_sensor.')as '.$namaSensor;
			}
			else{
				$namaSensor='Rerata_'.$param->nama_parameter;
				$select='avg('.$param->kolom_sensor.')as '.$namaSensor;
			}
			$sensor=$param->kolom_sensor;
			if($param->nama_parameter == 'Debit') {
				$namaSensor='Rerata_'.$param->nama_parameter;
				$select='avg('.$param->kolom_acuan.')as '.$namaSensor;
				$sensor=$param->kolom_acuan;
			}
			$satuan=$param->satuan;
			$namaparameter=$param->nama_parameter;
		}
		$query_data = $this->db->query("SELECT waktu,DATE(waktu) as tanggal,".$select.",min(".$sensor.") as min,max(".$sensor.") as max FROM ".$tabel." where code_logger='".$idlogger."' and waktu >='" . $awal . "' and waktu <='" . $akhir . " 23:59:00' group by HOUR(waktu),DAY(waktu),MONTH(waktu),YEAR(waktu) order by waktu asc;");
		$dbt = 0;
		$hsl = $query_data->result();

		foreach($hsl as $datalog)
		{
			$n_data = $datalog->$namaSensor;
			$max_value = $datalog->max;
			$min_value = $datalog->min;
			if($namaparameter =='Illumination'){
				$n_data = $n_data/1000;
				$max_value = $datalog->max/1000;
				$min_value = $datalog->min/1000;
			}
			$waktu[]= date('Y-m-d H',strtotime($datalog->waktu)).":00";
			$data[]= number_format($n_data,2,'.',''); 
			$min[]=number_format($min_value,2,'.','');
			$max[]=number_format($max_value,2,'.','');
		}
		if(!$hsl){
			$stts = 'error';
			$dataAnalisa = null;
		}else{
			$stts = 'sukses';
			$dataAnalisa=array(
				'status'=>'sukses',
				'idLogger' =>$idlogger,
				'nosensor'=>$sensor,
				'namaSensor' =>$namaSensor,
				'satuan'=>$satuan,
				'waktu' =>$waktu,
				'tipegraf'=>$param->tipe_graf,
				'data'=>$data,
				'datamin'=>$min,
				'datamax'=>$max,
			);
		}

		echo json_encode(
			array(
				'status' => $stts,
				'data'=>$dataAnalisa
			)
		);
	}

	function analisapertahun()
	{
		$idlogger=$this->input->get('idlogger');
		$idsensor=$this->input->get('idsensor');
		$tabel=$this->input->get('tabel');
		$tanggal=$this->input->get('tahun');

		$data=array();
		$min=array();
		$max=array();
		$dta_avg = array();
		$dta_min = array();
		$dta_max = array();

		$qparam=$this->db->query("SELECT * FROM parameter_sensor where id_param='".$idsensor."'");	
		
		foreach($qparam->result() as $param)
		{
			if($param->tipe_graf=='column')
			{
				$namaSensor='Akumulasi_'.$param->nama_parameter;
				$select='sum('.$param->kolom_sensor.')as '.$namaSensor;
			}
			else{
				//$namaSensor='Rerata_'.$param->nama_parameter;
				$namaSensor='Rerata_'.$param->nama_parameter;
				$select='avg('.$param->kolom_sensor.')as '.$namaSensor;
			}
			$sensor=$param->kolom_sensor;
			if($param->nama_parameter == 'Debit') {
				$namaSensor='Rerata_'.$param->nama_parameter;
				$select='avg('.$param->kolom_acuan.')as '.$namaSensor;
				$sensor=$param->kolom_acuan;
			}
			$satuan=$param->satuan;
			$namaparameter=$param->nama_parameter;
		}
		$query_data = $this->db->query("SELECT waktu,DATE(waktu) as tanggal,MONTH(waktu) as bulan,".$select.",min(".$sensor.") as min,max(".$sensor.") as max FROM ".$tabel." where code_logger='".$idlogger."' and waktu >= '".$tanggal."-01-01 00:00' and waktu <= '".$tanggal."-12-31 23:59' group by MONTH(waktu),YEAR(waktu);");
		
		$dbt = 0;
		foreach($query_data->result() as $datalog)
		{
			$n_data = $datalog->$namaSensor;
			$max_value = $datalog->max;
			$min_value = $datalog->min;
			if($namaparameter =='Illumination'){
				$n_data = $n_data/1000;
				$max_value = $datalog->max/1000;
				$min_value = $datalog->min/1000;
			}
			$waktu[]= date('Y-m',strtotime($datalog->waktu));
			$data[]= number_format($n_data,2,'.',''); 
			$min[]=number_format($min_value,2,'.','');
			$max[]=number_format($max_value,2,'.','');
		}

		if(!$query_data->result_array()){
			$stts = 'error';
			$dataAnalisa = null;
		}else{
			$stts = 'sukses';
			$dataAnalisa=array(
				'status'=>'sukses',
				'idLogger' =>$idlogger,
				'nosensor'=>$sensor,
				'namaSensor' =>$namaSensor,
				'satuan'=>$satuan,
				'waktu' =>$waktu,
				'tipegraf'=>$param->tipe_graf,
				'data'=>$data,
				'datamin'=>$min,
				'datamax'=>$max,
			);
		}

		echo json_encode(
			array(
				'status' => $stts,
				'data'=>$dataAnalisa
			)
		);
	}


	function infov2() {
		$skr2 = date('Y-m-d H:i',mktime(0,0,0,date('m'),date('d')-1,date('Y')));

		$idlogger=$this->input->get('idlogger');
		$data_informasi=array();
		$data_terakhir=array();
		$query = $this->db->query('SELECT * from kategori_logger INNER JOIN t_logger on t_logger.kategori_log = kategori_logger.id_katlogger;');
		foreach($query->result() as $code_l)
		{
			$tabel = $code_l->temp_data;
		}
		$status_sd='OK';
		$query_informasi=$this->db->query('SELECT * FROM t_informasi where logger_id="'.$idlogger.'"');
		foreach($query_informasi->result() as $data)
		{
			$query_logger=$this->db->query('SELECT * FROM t_logger where id_logger="'.$idlogger.'"');
			foreach($query_logger->result() as $logger)
			{
				$query_kategori=$this->db->query('SELECT * FROM kategori_logger where id_katlogger="'.$logger->kategori_log.'"');
				foreach($query_kategori->result() as $kategori)
				{
					$query_ceksd=$this->db->query('SELECT sensor13,sensor12 FROM '.$kategori->temp_data.' where code_logger="'.$idlogger.'" order by waktu desc limit 1');
					foreach($query_ceksd->result() as $ceksd)
					{
						if($ceksd->sensor13 == '1')
						{
							$status_sd='OK';
						}
						else{
							$status_sd='Terjadi Kesalahan';
						}

						if($ceksd->sensor12 == '1')
						{
							$status_sensor='OK';
						}
						else{
							$status_sensor='Terjadi Kesalahan';
						}
					}

				}
			}

			if (empty($data->elevasi)) {
				$data_informasi=array(
					array(
						'nama'=>'ID Logger','nilai'=>$data->logger_id),
					array('nama'=>
						  'Seri', 'nilai'=>$data->seri),
					array('nama'=>
						  'Serial Number', 'nilai'=>$data->serial_number),
					array('nama'=>
						  'Sensor','nilai'=>$data->sensor),
					array('nama'=>
						  'Status SD','nilai'=>$status_sd),
					array('nama'=>
						  'Awal Kontrak','nilai'=>$data->tgl_kontrak),
					array('nama'=>
						  'Akhir Garansi','nilai'=>$data->garansi),
					array('nama'=>
						  'Logger Aktif','nilai'=>$data->tgl_aktif),
					array('nama'=>
						  'No Seluler','nilai'=>$data->nosell),
						array('nama'=>
						  'IMEI','nilai'=>$data->imei),
					/*
					array('nama'=>
						  'Nama PIC','nilai'=>$data->nama_pic),
					array('nama'=>
						  'No PIC','nilai'=>$data->no_pic),
						  */
				);
			}else {
				$data_informasi=array(
					array(
						'nama'=>'ID Logger','nilai'=>$data->logger_id),
					array('nama'=>
						  'Seri', 'nilai'=>$data->seri),
					array('nama'=>
						  'Serial Number', 'nilai'=>$data->serial_number),
					array('nama'=>'Sensor','nilai'=>$data->sensor),
					array('nama'=>
						  'Status SD','nilai'=>$status_sd),
					array('nama'=>
						  'Awal Kontrak','nilai'=>$data->tgl_kontrak),
					array('nama'=>
						  'Akhir Garansi','nilai'=>$data->garansi),
					array('nama'=>
						  'Logger Aktif','nilai'=>$data->tgl_aktif),
					array('nama'=>'Elevasi','nilai'=>$data->elevasi),
					array('nama'=>
						  'No Seluler','nilai'=>$data->nosell),
					array('nama'=>
						  'IMEI','nilai'=>$data->imei),
					/*
					array('nama'=>
						  'Nama PIC','nilai'=>$data->nama_pic),
					array('nama'=>
						  'No PIC','nilai'=>$data->no_pic),
					*/
				);
			}

		}




		$data_terakhir=array(
			'data'=>$data_informasi,
			//'elevasi'=>$data->elevasi
		);

		echo json_encode($data_terakhir);


	}

}
