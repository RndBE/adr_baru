<?php
function loggercombo(){
	
	$ci=& get_instance();
	$ci->load->database('default');
	$ci->db->from('t_logger');
		$ci->db->join('t_lokasi','t_lokasi.idlokasi=t_logger.lokasi_logger');
		$ci->db->join('kategori_logger','kategori_logger.id_katlogger=t_logger.kategori_log');
		//$ci->db->where('logger_code',$ci->session->userdata('code_logger'));
		$data=$ci->db->get();
		if(  $data->num_rows() > 0){
			$drop=array();
			foreach( $data->result() as $row)
				
				{
					$drop['']=  'Pilih Lokasi';
					$drop[$row->id_logger.','.$row->controller.','.$row->tabel] = $row->nama_lokasi;
				}
			return ($drop);
		}
		else 
		{
			$drop=array(
			''=>"Tidak Ada Logger"
				);
			return $drop;
		}
}

function lokasilogger()
	{
		$url="https://api.beacontelemetry.com/lokasi/weblokasi?iduser=12&leveluser=User";
        $get_url = file_get_contents($url);
        $data = json_decode($get_url);
        return $data;

	}

