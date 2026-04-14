<?php
class M_inputdatamanual extends CI_Model{
	function __construct()
	{
		parent::__construct();
		$this->db = $this->load->database('default', true);
	}

   function dataset($idsensor)
   {
   	$this->db->select('*');
   	$this->db->from('sensor_logger');
   	$this->db->join('t_dataset','sensorid=id_senlog');
   	$this->db->where('id_senlog',$idsensor);
   	$query=$this->db->get();

   	return $query;

   }
	
	function insert_data($data)
	{

	$this->db->insert('t_piezometer',$data);
	return;

	}
	

 

}