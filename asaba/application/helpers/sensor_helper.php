<?php
function sensor(){
	$ci=& get_instance();
	$ci->load->database('default');
	
	
	$ci->db->where('logger_id',$ci->session->userdata('id_logger'));
	
	$data=$ci->db->get('sensor_logger');
	if(  $data->num_rows>0){
		$drop=array();
		foreach( $data->result() as $row)
			
			{
				$drop['']=  'Pilih Sensor';
				$drop[$row->id_senlog] = $row->nama_sensor;
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
	//return $data->result();
}

function sensorpiezometer(){
	$ci=& get_instance();
	$ci->load->database('default');
	$ci->db->where('tabel','t_piezometer');
	$data=$ci->db->get('sensor_logger');
	if(  $data->num_rows() > 0){
		$drop=array();
		foreach( $data->result() as $row)
			
			{
				$drop['']=  'Pilih Sensor';
				$drop[$row->id_senlog] = $row->nama_sensor;
			}
		return ($drop);
	}
	else 
	{
		$drop=array(
		''=>"Tidak Ada Sensor"
			);
		return $drop;
	}
	//return $data->result();
}