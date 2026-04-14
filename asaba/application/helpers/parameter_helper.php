<?php
function parameter(){
	$ci=& get_instance();
	$ci->load->database('default');
	
	
	$ci->db->where('logger_id',$ci->session->userdata('id_logger'));
	$ci->db->where('sensor_id',$ci->session->userdata('id_sensor'));
	
	$data=$ci->db->get('parameter_sensor');
	if(  $data->num_rows() > 0){
		$drop=array();
		foreach( $data->result() as $row)
			
			{
				$drop['']=  'Pilih Parameter';
				$drop[$row->id_param] = $row->nama_parameter;
			}
		return ($drop);
	}
	else 
	{
		$drop=array(
		''=>"Tidak Ada Parameter"
			);
		return $drop;
	}
	//return $data->result();
}