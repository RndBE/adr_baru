
<?php if ( ! defined('BASEPATH')) exit('No direct script access allowed');

class Analisa extends CI_Controller {

	function __construct() {
		parent::__construct();

		$this->load->model('m_analisa');
	}

	public function index()
	{
		if($this->session->userdata('logged_in'))
		{
			$this->load->library('googlemaps');
			// BAru
			$kategori=array();
			$query_kategori=$this->db->query('select * from kategori_logger');
			//$klasifikasi
			foreach ($query_kategori->result()  as $kat) {
				$tabel=$kat->tabel;
				$tabel_temp=$kat->temp_data;
				$content=array();
				$bidang = $this->session->userdata['bidang'];
				if($this->session->userdata['leveluser'] == 'admin' or $this->session->userdata['leveluser'] == 'user'){
					$query_lokasilogger=$this->db->query("select * from t_logger inner join t_lokasi ON t_logger.lokasi_logger=t_lokasi.idlokasi where kategori_log='$kat->id_katlogger'");
				}else{
					$query_lokasilogger=$this->db->query("select * from t_logger inner join t_lokasi ON t_logger.lokasi_logger=t_lokasi.idlokasi where kategori_log='$kat->id_katlogger' and t_logger.bidang='$bidang' ");
				}

				foreach ($query_lokasilogger->result() as $loklogger){
					$id_logger=$loklogger->id_logger;

					$parameter=array();
					$query_data=$this->db->query('select * from '.$tabel_temp.' where code_logger="'.$id_logger.'"');

					if($kat->controller == 'awr')
					{			
						foreach ($query_data->result() as $dt){
							$waktu=$dt->waktu;
							$awal=date('Y-m-d H:i',(mktime(date('H')-1)));

							if($waktu >= $awal)
							{
								$icon_marker=base_url().'pin_marker/awr_hijau.png';
								$status='<p style="color:green;margin-bottom:0px">Koneksi Terhubung</p>';
								$statlog='th'; 
								$statuspantau = "Tidak Hujan";
								$anim="";
							}
							else{
								$icon_marker=base_url().'pin_marker/awr-hitam.png';
								$status='<p style="color:red;margin-bottom:0px">Koneksi Terputus</p>';
								$statlog='off';
								$statuspantau = "-";
								$anim="BOUNCE";
							}

						}
					}
					elseif($kat->controller == 'awlr')
					{
						foreach ($query_data->result() as $dt){
							$waktu=$dt->waktu;
							$awal=date('Y-m-d H:i',(mktime(date('H')-1)));

							if($waktu >= $awal){

								$icon_marker=base_url().'pin_marker/'.$kat->controller.'-hijau.png';
								$status='<p style="color:green;margin-bottom:0px">Koneksi Terhubung</p>';
								$statlog='aman'; 
								$statuspantau = "Tingkat Status Belum Diatur";
								$anim=" ";


							}else{
								$icon_marker=base_url().'pin_marker/'.$kat->controller.'-hitam.png';
								$status='<p style="color:red;margin-bottom:0px">Koneksi Terputus</p>';
								$statlog='off';
								$statuspantau = "-";
								$anim="BOUNCE";
							}

						}

					}



					// create marker for each province

					$marker['position'] = $loklogger->latitude.','.$loklogger->longitude;

					$content =
						"<h3 style='color:#333;'><strong>".$loklogger->nama_logger."</strong></h3>".
						"<table style='color:#333;' class='table card-table table-striped'>".
						"<tbody>".
						"<tr>".
						"<td>Nama Pos </td><td>: </td> <td>".$loklogger->nama_lokasi."</td>".
						"</tr>".
						"<tr>".
						"<td>Latitude </td><td>: </td> <td>".$loklogger->latitude."</td>".
						"</tr>".
						"<tr>".
						"<td>Longitude </td><td>: </td> <td>".$loklogger->longitude."</td>".
						"</tr>".
						"<tr>".
						"<td>Status Logger</td><td>:</td> <td>".$status."</td>".
						"</tr>".
						"</tbody>".
						"</table><br/>".
						"<br/>".
						"<div class='col-md-12'> <center>".anchor($kat->controller.'/set_sensorselect/'.$id_logger.'/'.$tabel,"<strong> Lihat Data </strong> ")." </center></div>";

					$marker['infowindow_content'] = $content;
					$marker['title'] = $loklogger->nama_lokasi;
					$marker['icon'] = $icon_marker;
					$marker['animation'] = $anim ; 	
					$marker['category'] = $kat->controller;
					$marker['category_group'] = $kat->controller.'_'.$statlog;
					$marker['icon_scaledSize'] = '25,33';

					$this->googlemaps->add_marker($marker);
				}

			}

			//

			//$data['dt_sensor']=$dataSensor;
			$config['center'] = '-7.987110, 111.703332'; 
			//	$config['zoom'] = $this->session->userdata('zoom'); //zoom value
			$config['zoom'] = "15";
			$this->googlemaps->initialize($config);
			$data['map'] = $this->googlemaps->create_map();
			$data['konten']="konten/back/v_analisa";
			$this->load->view('template_admin/site',$data);
		}
		else
		{
			redirect('login');
		}

	}

	public function tes()
	{
		if($this->session->userdata('logged_in'))
		{
			$this->load->library('googlemaps');
			// BAru
			$kategori=array();
			if($this->session->userdata['bidang']=='ptpn'){
				$query_kategori=$this->db->query('select * from kategori_logger where tabel = "arr"');
			}else{
				$query_kategori=$this->db->query('select * from kategori_logger');
			}

			//$klasifikasi
			foreach ($query_kategori->result()  as $kat) {
				$tabel=$kat->tabel;
				$tabel_temp=$kat->temp_data;
				$content=array();
				$bidang = $this->session->userdata['bidang'];
				if($this->session->userdata['bidang']=='ptpn'){
					$query_lokasilogger=$this->db->query("select * from t_logger inner join t_lokasi ON t_logger.lokasi_logger=t_lokasi.idlokasi where kategori_log='$kat->id_katlogger' and id_logger='10184' or id_logger='10160'");
				}elseif($this->session->userdata['leveluser'] == 'admin' or $this->session->userdata['leveluser'] == 'user'){

					$query_lokasilogger=$this->db->query("select * from t_logger inner join t_lokasi ON t_logger.lokasi_logger=t_lokasi.idlokasi where kategori_log='$kat->id_katlogger'");
				}else{
					$query_lokasilogger=$this->db->query("select * from t_logger inner join t_lokasi ON t_logger.lokasi_logger=t_lokasi.idlokasi where kategori_log='$kat->id_katlogger' and t_logger.bidang='$bidang' ");
				}

				foreach ($query_lokasilogger->result() as $loklogger){
					$id_logger=$loklogger->id_logger;
					$bidang = $loklogger->bidang;
					$parameter=array();
					$query_data=$this->db->query('select * from '.$tabel_temp.' where code_logger="'.$id_logger.'"');

					if($kat->controller == 'arr')
					{
						$query_akumulasi = $this->db->query('select sum(sensor1) as sensor1,sum(sensor9) as sensor9 from '.$kat->tabel.' where code_logger = "'.$id_logger.'" and waktu >= "'.date('Y-m-d H').':00" ');
						foreach($query_akumulasi->result() as $akum)
						{
							if($id_logger == '10109')
							{
								$dtakum=$akum->sensor9;
							}
							else{
								$dtakum=$akum->sensor1;
							}}				
						foreach ($query_data->result() as $dt){
							$waktu=$dt->waktu;
							$awal=date('Y-m-d H:i',(mktime(date('H')-1)));
							$query_hujan=$this->db->query('select * from klasifikasi_hujan where waktuper = "perjam" ');
							$query_parameter=$this->db->query('select * from parameter_sensor where logger_id="'.$id_logger.'" and 		parameter_utama = "1" ');
							foreach ($query_parameter->result() as $param) {
								$kolom=$param->kolom_sensor;
								$dta=$dt->$kolom;
								$get='tabel='.$kat->tabel.'&id_param='.$param->id_param;
								$link_parameter= anchor($kat->controller.'/set_sensordash?'.$get,$param->nama_parameter);
								$parameter[]='
								<td>'.$link_parameter.'</td><td>'.$dta.' '.$param->satuan.'</td>
								';	
							}
							foreach($query_hujan->result() as $klashujan){
								$sringan=$klashujan->biru;
								$ringan=$klashujan->biru_tua;
								$sedang=$klashujan->kuning;
								$lebat=$klashujan->oranye;
								$slebat=$klashujan->merah;
							}
							######### cek status koneksi ######
							$dta=$dt->$kolom;
							if($waktu >= $awal)
							{
								if($dtakum < $sringan) //Tidak Hujan
								{
									$icon_marker=base_url().'pin_marker/'.$kat->controller.'-hijau.png';
									$status='<p style="color:green">Koneksi Terhubung</p>';
									$statlog='th'; 
									$statuspantau = "Tidak Hujan";
									$anim="";
								}
								elseif($dtakum >= $sringan && $dtakum < $ringan) // Sangat Ringan
								{
									$icon_marker=base_url().'pin_marker/'.$kat->controller.'-cyan.png';
									$status='<p style="color:green">Koneksi Terhubung</p>';
									$statlog='sr';
									$statuspantau = "Hujan - Sangat Ringan";
									$anim="";
								}
								elseif($dtakum >= $ringan && $dtakum < $sedang) // Ringan
								{
									$icon_marker=base_url().'pin_marker/'.$kat->controller.'-nila.png';
									$status='<p style="color:green">Koneksi Terhubung</p>';
									$statlog='r'; 
									$statuspantau = "Hujan - Ringan";
									$anim="";
								}
								elseif($dtakum >= $sedang && $dtakum < $lebat) // Sedang
								{
									$icon_marker=base_url().'pin_marker/'.$kat->controller.'-kuning.png';
									$status='<p style="color:green">Koneksi Terhubung</p>';
									$statlog='s'; 
									$statuspantau = "Hujan - Sedang";
									$anim="";
								}
								elseif($dtakum >= $lebat && $dtakum < $slebat) // Lebat
								{
									$icon_marker=base_url().'pin_marker/'.$kat->controller.'-orange.png';
									$status='<p style="color:green">Koneksi Terhubung</p>';
									$statlog='l';
									$statuspantau = "Hujan - Lebat";
									$anim="BOUNCE";
								}
								elseif($dtakum >= $slebat) // Sangat Lebat
								{
									$icon_marker=base_url().'pin_marker/'.$kat->controller.'-merah.png';
									$status='<p style="color:green">Koneksi Terhubung</p>';
									$statlog='sl'; 
									$statuspantau = "Hujan - Sangat Lebat";
									$anim="BOUNCE";
								}

							}
							else{
								$icon_marker=base_url().'pin_marker/'.$kat->controller.'-hitam.png';
								$status='<p style="color:red">Koneksi Terputus</p>';
								$statlog='off';
								$statuspantau = "-";
								$anim="BOUNCE";
							}

						}
					}
					elseif($kat->controller == 'awlr')
					{
						foreach ($query_data->result() as $dt){
							$waktu=$dt->waktu;
							$awal=date('Y-m-d H:i',(mktime(date('H')-1)));
							$query_siaga=$this->db->query('select * from klasifikasi_tma where idlogger = "'.$id_logger.'"  ');
							$query_parameter=$this->db->query('select * from parameter_sensor where logger_id="'.$id_logger.'" and 		parameter_utama = "1" ');
							foreach ($query_parameter->result() as $param) {
								$kolom=$param->kolom_sensor;
								$dta=$dt->$kolom;
								$get='tabel='.$kat->tabel.'&id_param='.$param->id_param;
								$link_parameter= anchor($kat->controller.'/set_sensordash?'.$get,$param->nama_parameter);
								$parameter[]='
								<td>'.$link_parameter.'</td><td>'.$dta.' '.$param->satuan.'</td>
								';	
							}
							if($query_siaga->result()){
								foreach($query_siaga->result() as $klastma){
									$waspada=$klastma->siaga2;
									$siaga=$klastma->siaga1;
									$id_logger2 = $klastma->idlogger;
								}
							}else{
								$waspada=100;
								$siaga=100;
								$id_logger2 = null;
							}

							######### cek status koneksi ######
							$dta=$dt->$kolom;

							if($waktu >= $awal)
							{
								if($dta < $waspada) // Aman
								{
									if($bidang == 'irigasi'){
										if($id_logger != $id_logger2){
											$icon_marker=base_url().'pin_marker/awlr-iri-hijau.png';
											$status='<p style="color:green">Koneksi Terhubung</p>';
											$statlog='aman'; 
											$statuspantau = "Tingkat Status Belum Diatur";
											$anim=" ";
										}else{
											$icon_marker=base_url().'pin_marker/awlr-iri-hijau.png';
											$status='<p style="color:green">Koneksi Terhubung</p>';

											$statlog='aman'; 
											$statuspantau = "Aman";
											$anim=" ";
										}
									}else{
										if($id_logger != $id_logger2){
											$icon_marker=base_url().'pin_marker/'.$kat->controller.'-hijau.png';
											$status='<p style="color:green">Koneksi Terhubung</p>';
											$statlog='aman'; 

											$statuspantau = "Tingkat Status Belum Diatur";
											$anim=" ";
										}else{
											$icon_marker=base_url().'pin_marker/'.$kat->controller.'-hijau.png';
											$status='<p style="color:green">Koneksi Terhubung</p>';
											$statlog='aman'; 

											$statuspantau = "Aman";
											$anim=" ";
										}
									}

								}
								elseif($dta >= $waspada && $dta < $siaga) // Waspada
								{
									if($bidang == 'irigasi'){
										if($id_logger != $id_logger2){
											$icon_marker=base_url().'pin_marker/awlr-iri-kuning.png';
											$status='<p style="color:green">Koneksi Terhubung</p>';

											$statlog='aman'; 
											$statuspantau = "Tingkat Status Belum Diatur";
											$anim=" ";
										}else{
											$icon_marker=base_url().'pin_marker/awlr-iri-kuning.png';
											$status='<p style="color:green">Koneksi Terhubung</p>';

											$statlog='aman'; 
											$statuspantau = "Aman";
											$anim=" ";
										}
									}else{
										$icon_marker=base_url().'pin_marker/'.$kat->controller.'-kuning.png';
										$status='<p style="color:green">Koneksi Terhubung</p>';
										$statlog='waspada'; 

										$statuspantau = "Waspada";
										$anim=" ";
									}


								}
								elseif($dta >= $siaga) // Siaga
								{
									if($bidang == 'irigasi'){
										if($id_logger != $id_logger2){
											$icon_marker=base_url().'pin_marker/awlr-iri-merah.png';
											$status='<p style="color:green">Koneksi Terhubung</p>';

											$statlog='aman'; 
											$statuspantau = "Tingkat Status Belum Diatur";
											$anim=" ";
											$anim = "BOUNCE";
										}else{
											$icon_marker=base_url().'pin_marker/awlr-iri-merah.png';
											$status='<p style="color:green">Koneksi Terhubung</p>';

											$statlog='aman'; 
											$statuspantau = "Aman";
											$anim=" ";
											$anim = "BOUNCE";
										}
									}else{
										$icon_marker=base_url().'pin_marker/'.$kat->controller.'-merah.png';
										$status='<p style="color:green">Koneksi Terhubung</p>';
										$statlog='siaga';

										$statuspantau = "Siaga";
										$anim="BOUNCE";
									}

								}


								//}
							}else{
								if($bidang == 'irigasi'){
									$icon_marker=base_url().'pin_marker/awlr-iri-hitam.png';
									$status='<p style="color:red">Koneksi Terputus</p>';
									$statlog='off'; 
									$statuspantau = "-";
									$anim = "BOUNCE";
								}else{
									$icon_marker=base_url().'pin_marker/'.$kat->controller.'-hitam.png';
									$status='<p style="color:red">Koneksi Terputus</p>';
									$statlog='off';

									$statuspantau = "-";
									$anim = "BOUNCE";
								}

							}

						}

					}


					$size = '25,33';
					// create marker for each province

					$marker['position'] = $loklogger->latitude.','.$loklogger->longitude;

					$content =
						"<h3 style='color:#333;'><strong>".$loklogger->nama_logger."</strong></h3>".
						"<table style='color:#333;' class='table card-table table-striped'>".
						"<tbody>".
						"<tr>".

						"<td>Nama Pos </td><td>: </td> <td>".$loklogger->nama_lokasi."</td>".
						"</tr>".
						"<tr>".
						"<td>Bidang </td><td>: </td> <td style='text-transform:capitalize'>".$loklogger->bidang."</td>".
						"</tr>".
						"<tr>".
						"<td>Latitude </td><td>: </td> <td>".$loklogger->latitude."</td>".
						"</tr>".
						"<tr>".
						"<td>Longitude </td><td>: </td> <td>".$loklogger->longitude."</td>".
						"</tr>".
						"<tr>".
						"<td>Status Logger</td><td>:</td> <td>".$status."</td>".
						"</tr>".
						"<tr>".
						"<td>Status Pemantauan </td><td>: </td> <td>".$statuspantau."</td>".
						"</tr>".

						"</tbody>".
						"</table><br/>".
						"<br/>".
						"<div class='col-md-12'> <center>".anchor($kat->controller.'/set_sensorselect/'.$id_logger.'/'.$tabel,"<strong> Lihat Data </strong> ")." </center></div>";

					$marker['infowindow_content'] = $content;
					$marker['title'] = $loklogger->nama_lokasi;
					$marker['icon'] = $icon_marker;
					$marker['animation'] = $anim ; 	
					$marker['category'] = $kat->controller;
					$marker['category_group'] = $kat->controller.'_'.$statlog;
					if($bidang == 'irigasi'){
						$marker['icon_scaledSize'] = '26,36';
					}else{
						$marker['icon_scaledSize'] = '25,33';
					}
					$this->googlemaps->add_marker($marker);
				}

			}

			//

			//$data['dt_sensor']=$dataSensor;
			$config['center'] = '-7.6935218,112.849764'; 
			//	$config['zoom'] = $this->session->userdata('zoom'); //zoom value
			$config['zoom'] = "9";

			$this->googlemaps->initialize($config);
			$data['map'] = $this->googlemaps->create_map();
			$data['konten']="konten/back/v_analisa";
			$this->load->view('template_admin/site',$data);
		}
		else
		{
			redirect('login');
		}

	}



	function combologger()
	{
		$set =explode(',',$this->input->post('id_logger'));
		$idlogger=$set[0];
		$controller=$set[1];
		$tabel=$set[2];

		redirect($controller.'/set_sensorselect/'.$idlogger.'/'.$tabel);
	}
}
